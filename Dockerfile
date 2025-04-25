# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONUNBUFFERED 1
ENV FLASK_APP app.py
ENV FLASK_RUN_HOST 0.0.0.0

# Install system dependencies: Nginx, Supervisor, build tools (for pip packages if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies: Flask and Gunicorn
RUN pip install --no-cache-dir Flask gunicorn

# Create necessary directories
RUN mkdir -p /var/log/supervisor /app /data /run/nginx

# Copy Supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy Nginx configuration, replacing the default
COPY nginx.conf /etc/nginx/nginx.conf

# Copy backend application code
WORKDIR /app
COPY app.py .
# Initialize the database structure during build (optional, can also be done on first run)
# RUN flask initdb

# Copy frontend static files into the Nginx root directory
COPY index.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY icons /usr/share/nginx/html/icons
COPY img /usr/share/nginx/html/img

# Define the volume for persistent data (SQLite database)
VOLUME /data

# Expose port 80 for Nginx
EXPOSE 80

# Start Supervisor to manage Nginx and Gunicorn
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]