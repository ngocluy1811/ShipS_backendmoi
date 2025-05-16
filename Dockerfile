FROM node:18

WORKDIR /app

# Install Python and required packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy requirements file and install Python dependencies
COPY requirements.txt .
RUN pip3 install --break-system-packages -r requirements.txt

# Copy source code
COPY . .

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl

# Expose ports
EXPOSE 3000
EXPOSE 5000

# Start both services using a shell script
COPY start.sh .
RUN chmod +x start.sh

CMD ["./start.sh"] 