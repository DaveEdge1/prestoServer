FROM continuumio/anaconda3

COPY environ.yml /tmp/environ.yml
RUN conda env create -n lipd_gen --file /tmp/environ.yml

COPY generate.py /generate.py

SHELL ["conda", "run", "-n", "lipd_gen", "/bin/bash", "-c"]

# Usage:
#   docker build -t davidedge/lipd_webapps:lipdGenerator .
#   docker run --rm \
#     -v /path/to/query_params.json:/query_params.json:ro \
#     -v /path/to/output:/output \
#     davidedge/lipd_webapps:lipdGenerator [query_params] [output_dir] [format]
#
# format: lpd | pickle | all  (default: all)
# Outputs written to /output/:
#   *.lpd files
#   lipd_files.zip
#   lipd.pkl          (CFR-compatible pandas DataFrame)
#   lipd_legacy.pkl   (legacy dict format)
ENTRYPOINT ["conda", "run", "--no-capture-output", "-n", "lipd_gen", "python", "/generate.py"]
CMD ["/query_params.json", "/output", "all"]
