FROM python:3.12-slim

WORKDIR /app

COPY . .

EXPOSE 5000

CMD ["python", "run_server.py"]
