FROM docker.io/cloudflare/sandbox:0.7.21

RUN apt-get update && apt-get install -y \
  gh \
  ripgrep \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@1.14.48

COPY bin/droid-supervisor.mjs /usr/local/bin/droid-supervisor
RUN chmod +x /usr/local/bin/droid-supervisor

EXPOSE 8080
