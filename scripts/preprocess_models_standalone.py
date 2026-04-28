#!/usr/bin/env python3
"""
Pre-process Holocene DA model data at common resolutions.
Standalone script — runs natively (no Docker), requires conda environment.

Setup:
  conda create -n preprocess python=3.10 numpy scipy xarray xesmf esmpy netcdf4 -c conda-forge
  conda activate preprocess

Usage:
  python preprocess_models_standalone.py --data-dir "C:/Users/dce25/Downloads/holocene_da_data/holocene_da_data" --output-dir ./processed

Then upload to GitHub Release:
  gh release upload model-data-v1 --repo DaveEdge1/presto-holocene_da processed/*.nc
"""

import argparse
import os
import sys
import gc
import numpy as np
import xarray as xr
import netCDF4
import glob


RESOLUTIONS = [200, 500, 1000, 100, 50, 20, 10]  # Ordered smallest-first
AGE_RANGE = [0, 22000]

# Standard regridded output grid (matches da_utils.regrid_model)
LAT_REGRID = np.arange(-88.59375, 90, 2.8125)
LON_REGRID = np.arange(0, 360, 3.75)


def regrid_model(var, lat, lon, age):
    """Regrid to standard 96x64 grid. Adapted from da_utils.regrid_model."""
    import xesmf as xe

    var_xarray = xr.Dataset(
        {'variable': (['age', 'month', 'lat', 'lon'], var)},
        coords={
            'lat':   (['lat'], lat, {'units': 'degrees_north'}),
            'lon':   (['lon'], lon, {'units': 'degrees_east'}),
            'month': (['month'], np.arange(1, 13)),
            'age':   (['age'], age),
        },
    )

    data_format = xr.Dataset({
        'lat': (['lat'], LAT_REGRID, {'units': 'degrees_north'}),
        'lon': (['lon'], LON_REGRID, {'units': 'degrees_east'}),
    })

    regridder = xe.Regridder(var_xarray, data_format, 'conservative_normed', periodic=True)
    var_regridded = regridder(var_xarray, keep_attrs=True)

    return var_regridded['variable'].values, LAT_REGRID, LON_REGRID


def load_and_average_hadcm3(data_path, time_resolution, age_range):
    """Load HadCM3 data and time-average. Chunked loading to stay under memory limits."""
    print('  Loading HadCM3 metadata...')
    handle = xr.open_dataset(data_path, decode_times=False)
    lat = handle['latitude'].values
    lon = handle['longitude'].values
    age_monthly = handle['t'].values
    nlat, nlon = len(lat), len(lon)

    age = -1 * np.floor(np.mean(np.reshape(age_monthly, (int(len(age_monthly) / 12), 12)), axis=1))

    # Select age range
    idx = np.where((age >= age_range[0]) & (age < age_range[1]))[0]
    n_means = len(idx) // time_resolution
    print(f'  {len(idx)} years -> {n_means} bins at {time_resolution}yr resolution')

    # Process bin-by-bin: load only the months needed for each bin
    var_data = handle['temp_mm_1_5m']  # lazy — not loaded yet
    var_avg = np.zeros((n_means, 12, nlat, nlon), dtype=np.float32)
    age_avg = np.zeros(n_means, dtype=np.float64)

    for b in range(n_means):
        bin_year_idx = idx[b * time_resolution : (b + 1) * time_resolution]
        # Convert year indices to monthly indices
        month_start = int(bin_year_idx[0]) * 12
        month_end = int(bin_year_idx[-1] + 1) * 12
        # Load this chunk from disk
        chunk = np.squeeze(var_data[month_start:month_end].values).astype(np.float32)
        chunk = chunk.reshape(time_resolution, 12, nlat, nlon)
        chunk -= 273.15  # K to C
        var_avg[b] = chunk.mean(axis=0)
        age_avg[b] = age[bin_year_idx].mean()
        if (b + 1) % 10 == 0 or b == 0:
            print(f'    Bin {b+1}/{n_means} done')

    handle.close()

    ndays = np.array([30] * 12, dtype=np.float64)
    ndays_avg = np.repeat(ndays[None, :], n_means, axis=0)

    return var_avg.astype(np.float64), age_avg, lat, lon, ndays, ndays_avg


def load_and_average_trace(data_dir, time_resolution, age_range):
    """Load TraCE-21ka data and time-average. Chunked loading to stay under memory limits."""
    print('  Loading TraCE metadata...')
    filenames = sorted(glob.glob(data_dir + 'trace*TREFHT*.nc'))

    # Collect metadata (time coords) from all files without loading data
    all_times = []
    file_time_ranges = []  # (filename, global_month_start, n_months)
    global_offset = 0
    for fn in filenames:
        h = xr.open_dataset(fn, decode_times=False)
        t = h['time'].values
        if len(file_time_ranges) == 0:
            lat = h['lat'].values
            lon = h['lon'].values
        h.close()
        file_time_ranges.append((fn, global_offset, len(t)))
        all_times.append(t)
        global_offset += len(t)

    age_monthly = np.concatenate(all_times)
    nlat, nlon = len(lat), len(lon)
    nyears = len(age_monthly) // 12
    age = -1 * np.floor(np.mean(np.reshape(age_monthly * 1000, (nyears, 12)), axis=1))

    # Select age range
    idx = np.where((age >= age_range[0]) & (age < age_range[1]))[0]
    n_means = len(idx) // time_resolution
    print(f'  {len(idx)} years -> {n_means} bins at {time_resolution}yr resolution')

    def _read_months(month_start, month_end):
        """Read a range of months across multiple files."""
        chunks = []
        for fn, fstart, flen in file_time_ranges:
            fend = fstart + flen
            # Check overlap
            if month_end <= fstart or month_start >= fend:
                continue
            local_start = max(0, month_start - fstart)
            local_end = min(flen, month_end - fstart)
            h = xr.open_dataset(fn, decode_times=False)
            chunks.append(h['TREFHT'][local_start:local_end].values)
            h.close()
        return np.concatenate(chunks, axis=0)

    # Process bin-by-bin
    var_avg = np.zeros((n_means, 12, nlat, nlon), dtype=np.float32)
    age_avg = np.zeros(n_means, dtype=np.float64)

    for b in range(n_means):
        bin_year_idx = idx[b * time_resolution : (b + 1) * time_resolution]
        month_start = int(bin_year_idx[0]) * 12
        month_end = int(bin_year_idx[-1] + 1) * 12
        chunk = _read_months(month_start, month_end).astype(np.float32)
        chunk = chunk.reshape(time_resolution, 12, nlat, nlon)
        chunk -= 273.15  # K to C
        var_avg[b] = chunk.mean(axis=0)
        age_avg[b] = age[bin_year_idx].mean()
        if (b + 1) % 10 == 0 or b == 0:
            print(f'    Bin {b+1}/{n_means} done')

    ndays = np.array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], dtype=np.float64)
    ndays_avg = np.repeat(ndays[None, :], n_means, axis=0)

    return var_avg.astype(np.float64), age_avg, lat, lon, ndays, ndays_avg


def save_compressed(filepath, var_name, var_data, age, lat, lon, ndays, ndays_all):
    """Save regridded NetCDF with zlib compression."""
    ds = netCDF4.Dataset(filepath, 'w', format='NETCDF4')
    ds.createDimension('age', len(age))
    ds.createDimension('month', 12)
    ds.createDimension('lat', len(lat))
    ds.createDimension('lon', len(lon))

    # Compressed variables (complevel=4 is a good speed/size trade-off)
    v = ds.createVariable(var_name, 'f4', ('age', 'month', 'lat', 'lon'), zlib=True, complevel=4)
    v[:] = var_data

    ds.createVariable('age', 'f8', ('age',))[:] = age
    ds.createVariable('lat', 'f8', ('lat',))[:] = lat
    ds.createVariable('lon', 'f8', ('lon',))[:] = lon
    ds.createVariable('days_per_month', 'f8', ('month',))[:] = ndays
    ds.createVariable('days_per_month_all', 'f8', ('age', 'month'))[:] = ndays_all
    ds.close()


def process_model(model_name, time_resolution, age_range, output_dir, original_model_dir):
    """Process one model at one resolution."""
    base = model_name.replace('_regrid', '')

    if base == 'hadcm3':
        data_path = os.path.join(original_model_dir, 'HadCM3B_transient21k',
                                 'deglh.vn1_0.temp_mm_1_5m.monthly.MON.001_s.nc')
        var_avg, age_avg, lat, lon, ndays, ndays_avg = load_and_average_hadcm3(
            data_path, time_resolution, age_range)
    elif base == 'trace':
        trace_dir = os.path.join(original_model_dir, 'TraCE_21ka') + '/'
        var_avg, age_avg, lat, lon, ndays, ndays_avg = load_and_average_trace(
            trace_dir, time_resolution, age_range)
    else:
        raise ValueError(f'Unknown model: {base}')

    # Regrid
    print(f'  Regridding {var_avg.shape} to {len(LAT_REGRID)}x{len(LON_REGRID)} grid...')
    var_regrid, lat_regrid, lon_regrid = regrid_model(var_avg, lat, lon, age_avg)
    del var_avg; gc.collect()

    # Save with compression
    age_txt = f'{age_range[1]-1}-{age_range[0]}'
    filename = f'{model_name}.{age_txt}BP.tas.timeres_{time_resolution}.nc'
    filepath = os.path.join(output_dir, filename)

    print(f'  Saving compressed: {filename}')
    save_compressed(filepath, 'tas', var_regrid, age_avg, lat_regrid, lon_regrid, ndays, ndays_avg)

    del var_regrid; gc.collect()

    size_mb = os.path.getsize(filepath) / (1024 * 1024)
    print(f'  Done: {filename} ({size_mb:.1f} MB)')
    return filepath


def main():
    parser = argparse.ArgumentParser(description='Pre-process Holocene DA model data')
    parser.add_argument('--data-dir', type=str, required=True,
                        help='Path to extracted Zenodo data (contains models/original_model_data/)')
    parser.add_argument('--output-dir', type=str, default='./processed')
    parser.add_argument('--resolutions', type=int, nargs='+', default=RESOLUTIONS)
    parser.add_argument('--models', type=str, nargs='+', default=['hadcm3_regrid', 'trace_regrid'])
    args = parser.parse_args()

    output_dir = os.path.abspath(args.output_dir)
    os.makedirs(output_dir, exist_ok=True)

    # Find original_model_data directory
    for subpath in ['models/original_model_data', 'original_model_data']:
        candidate = os.path.join(os.path.abspath(args.data_dir), subpath)
        if os.path.exists(candidate):
            original_model_dir = candidate
            break
    else:
        print("ERROR: Cannot find original_model_data/ in --data-dir")
        sys.exit(1)

    print(f"Data: {original_model_dir}")
    print(f"Output: {output_dir}")
    print(f"Resolutions: {args.resolutions}")
    print(f"Models: {args.models}")
    print()

    total = len(args.resolutions) * len(args.models)
    count = 0
    for res in args.resolutions:
        for model in args.models:
            count += 1
            age_txt = f'{AGE_RANGE[1]-1}-{AGE_RANGE[0]}'
            filename = f"{model}.{age_txt}BP.tas.timeres_{res}.nc"
            filepath = os.path.join(output_dir, filename)

            if os.path.exists(filepath):
                size_mb = os.path.getsize(filepath) / (1024 * 1024)
                print(f"[{count}/{total}] SKIP: {filename} ({size_mb:.1f} MB)")
                continue

            print(f"[{count}/{total}] {filename}")
            try:
                process_model(model, res, AGE_RANGE, output_dir, original_model_dir)
            except Exception as e:
                print(f"  ERROR: {e}")
                import traceback
                traceback.print_exc()
            gc.collect()

    print("\n=== Summary ===")
    total_mb = 0
    for f in sorted(os.listdir(output_dir)):
        if f.endswith('.nc'):
            size_mb = os.path.getsize(os.path.join(output_dir, f)) / (1024 * 1024)
            total_mb += size_mb
            print(f"  {f} ({size_mb:.1f} MB)")
    print(f"  Total: {total_mb:.1f} MB")
    print(f"\nUpload: gh release upload model-data-v1 --repo DaveEdge1/presto-holocene_da {output_dir}/*.nc")


if __name__ == '__main__':
    main()
