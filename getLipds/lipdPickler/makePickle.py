import lipd
import pickle
import os
import zipfile
import glob

print(os.getcwd())
print(os.path.isfile('/lipd.pkl'))

D = lipd.readLipd("/output/")

# Create zip file of all .lpd files FIRST (before any processing that might fail)
print("Creating zip archive of .lpd files...")
lpd_files = glob.glob("/output/*.lpd")

if lpd_files:
    zip_path = '/output/lipd_files.zip'
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for lpd_file in lpd_files:
            # Add file to zip with just the filename (not full path)
            arcname = os.path.basename(lpd_file)
            zipf.write(lpd_file, arcname)
            print(f"  Added {arcname} to archive")
    print(f"Successfully created {zip_path} with {len(lpd_files)} .lpd files")
else:
    print("No .lpd files found to archive")

TS = lipd.extractTs(D)
all_data = {}
all_data['D'] = D

filetosave = open('/output/lipd.pkl','wb')

pickle.dump(all_data, filetosave, protocol = 2)

filetosave.close()

print("Successfully saved pickle to /output/lipd.pkl")
print("All files created successfully!")
