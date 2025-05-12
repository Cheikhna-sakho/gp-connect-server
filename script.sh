docker build -t api:latest .
docker tag api:latest <your_registry_url>/api:latest
docker push <your_registry_url>/api:latest