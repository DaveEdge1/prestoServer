
import numpy as np
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.util as cutil
import xarray as xr
import os

def make_figs():

    #%% LOAD DATA
    
    dir1 = os.path.join(os.getcwd(), "results/")
    
    for file in os.listdir(dir1):
        if file.endswith(".nc"):
            data_filename = os.path.join(dir1, file)
    
    output_dir = dir1
    
    # Load the Holocene Reconstruction
    data_xarray = xr.open_dataset(data_filename)
    tas_mean = data_xarray['recon_tas_mean'].values
    tas_ens  = data_xarray['recon_tas_ens'].values
    ages     = data_xarray['ages'].values
    lat      = data_xarray['lat'].values
    lon      = data_xarray['lon'].values
    exp_name = 'Holocene_DA'
     
    
    #%% CALCULATIONS
    
    # Compute 6-0.5 ka anomalies
    ages_anom = [5500,6500]
    ages_ref  = [0,1000]
    ind_anom = np.where((ages >= ages_anom[0]) & (ages <= ages_anom[1]))[0]
    ind_ref  = np.where((ages >= ages_ref[0])  & (ages <= ages_ref[1]))[0]
    tas_mean_change = np.mean(tas_mean[ind_anom,:,:],axis=0) - np.mean(tas_mean[ind_ref,:,:], axis=0)
    
    # Compute global means
    lat_weights = np.cos(np.radians(lat))
    tas_mean_zonal = np.mean(tas_mean,axis=2)
    tas_ens_zonal  = np.mean(tas_ens, axis=3)
    tas_mean_global = np.average(tas_mean_zonal,axis=1,weights=lat_weights)
    tas_ens_global  = np.average(tas_ens_zonal, axis=2,weights=lat_weights)
    
    
    #%% FIGURES
    
    plt.style.use('ggplot')
    
    # Make a map
    plt.figure(figsize=(12,8))
    ax1 = plt.subplot2grid((1,1),(0,0),projection=ccrs.Robinson()); ax1.set_global()
    tas_change_cyclic,lon_cyclic = cutil.add_cyclic_point(tas_mean_change,coord=lon)
    map1 = ax1.contourf(lon_cyclic,lat,tas_change_cyclic,np.arange(-1,1.1,.1),extend='both',cmap='bwr',transform=ccrs.PlateCarree())
    colorbar1 = plt.colorbar(map1,orientation='horizontal',ax=ax1,fraction=0.08,pad=0.02)
    colorbar1.set_label('$\Delta$T ($^\circ$C)',fontsize=16)
    colorbar1.ax.set_facecolor('none')
    ax1.set_title('Mean $\Delta$T ($^\circ$C) at 6-0.5 ka for the Holocene Reconstruction\nexp_name: '+exp_name,loc='center',fontsize=16)
    ax1.coastlines()
    ax1.gridlines(color='k',linewidth=1,linestyle=(0,(1,5)))
    ax1.spines['geo'].set_edgecolor('black')
    plt.savefig(output_dir+'reconstruction_map_6ka_'+exp_name+'.png',dpi=200,format='png',bbox_inches='tight')
    plt.close()
    
    # Make a time series
    f,ax1 = plt.subplots(1,1,figsize=(12,6))
    ax1.plot(ages,tas_mean_global,linewidth=3)
    ax1.fill_between(ages,np.percentile(tas_ens_global,2.5,axis=1),np.percentile(tas_ens_global,97.5,axis=1),alpha=0.2)
    ax1.set_xlim(max(ages),min(ages))
    ax1.set_ylabel('$\Delta$T ($^\circ$C)',fontsize=16)
    ax1.set_xlabel('Age (yr BP)',fontsize=16)
    ax1.set_title('Global mean $\Delta$T ($^\circ$C) for for the Holocene Reconstruction\nexp_name: '+exp_name,fontsize=18,loc='center')
    plt.savefig(output_dir+'reconstruction_ts_gmt_'+exp_name+'.png',dpi=200,format='png',bbox_inches='tight')
    plt.close()

    return 1
