FROM continuumio/anaconda3

# Install git for cloning upstream repo
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Clone upstream Holocene DA code (base scripts + model data references)
RUN git clone https://github.com/Holocene-Reconstruction/Holocene-code.git /app

WORKDIR /app

# Install conda environment
COPY environ.yml /app/environ.yml
RUN conda env create -n python3_da --file environ.yml

# Overlay custom/updated scripts (these take precedence over upstream)
COPY da_main_code.py /app/da_main_code.py
COPY da_load_proxies.py /app/da_load_proxies.py
COPY da_load_models.py /app/da_load_models.py
COPY make_basic_figures.py /app/make_basic_figures.py

# Create expected directory structure for proxy data, models, and results
RUN mkdir -p /proxies/temp12k /proxies/pages2k /proxies/pseudoproxies /results \
             /models/processed_model_data /models/original_model_data

SHELL ["conda", "run", "-n", "python3_da", "/bin/bash", "-c"]

ENTRYPOINT ["conda", "run", "--no-capture-output", "-n", "python3_da", "python", "-u", "da_main_code.py"]
CMD ["/config_default.yml"]
