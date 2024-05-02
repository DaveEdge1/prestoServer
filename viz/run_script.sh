#!/bin/bash
#SBATCH --job-name=presto_viz            # Name of the job
#SBATCH --output=logfile_presto_viz.txt  # File for output and errors
#SBATCH --time=1:00:00                   # Maximum time for job to run
#SBATCH --mem=5000                       # Memory (MB)

# This script can be run on Monsoon with the command: sbatch run_script.sh.

# Set directory for reconstruction data
# data_dir='/root/presto/userRecons/17095846334578667_HoloceneDA/'
data_dir="/root/presto/userRecons/$1/"

# Set directories (these only need to be set once.)
# output_dir='/root/presto/userRecons/17095846334578667/'  # The output files will be saved here
output_dir="/root/presto/userRecons/$1/"

web_data_dir='/root/presto/viz/web_assets/'  # This directory contains an html template and supporting files.

# Run scripts
echo "=== Processing reconstruction ==="

source /root/miniconda3/etc/profile.d/conda.sh &&
conda activate presto_env &&
python -u /root/presto/viz/1_format_data_daholocene_graphem.py $data_dir &&
python -u /root/presto/viz/2_make_maps_and_ts.py $data_dir $output_dir &&
python -u /root/presto/viz/3_make_html_file.py $data_dir $output_dir $web_data_dir &&

conda activate base

echo "=== All processing complete. Visualizations are stored in $output_dir ==="
