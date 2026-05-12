FROM docker.io/cloudflare/sandbox:0.7.21

RUN apt-get update && apt-get install -y \
  gh \
  ripgrep \
  && rm -rf /var/lib/apt/lists/*

EXPOSE 8080
