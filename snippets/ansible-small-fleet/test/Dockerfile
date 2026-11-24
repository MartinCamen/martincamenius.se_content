# An Ubuntu server in a box: systemd, sudo and python3, nothing else.
FROM ubuntu:24.04
RUN apt-get update \
    && apt-get install --yes --no-install-recommends systemd systemd-sysv sudo python3 \
    && rm -rf /var/lib/apt/lists/*
CMD ["/sbin/init"]
