FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi[standard] \
    uvicorn[standard] \
    fastdtw \
    requests \
    pandas \
    scipy \
    scikit-learn \
    numpy \
    mysql-connector-python \
    prometheus-fastapi-instrumentator

COPY app.py .

EXPOSE 8090

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "2"]
