#!/bin/bash

# Install what we can with apt

# Per https://github.com/docker/docker/issues/6345
# We have to do this for --net=host
#rm /usr/bin/chfn
#ln -s -f /bin/true /usr/bin/chfn

curl -sL https://deb.nodesource.com/setup | sudo bash -

apt-get -q update && apt-get install -qy \
  build-essential \
  libavahi-compat-libdnssd-dev \
  libasound2-dev \
  git \
  nodejs

# Fix avahi-daemon not working without dbus
#sed -i -e "s#\#enable-dbus=yes#enable-dbus=false#g" /etc/avahi/avahi-daemon.conf
#sed -i -e "s/^rlimit-nproc/#rlimit-nproc/g" /etc/avahi/avahi-daemon.conf

npm install -g babel@5

cd /var/tmp/
git clone https://github.com/stephen/airsonos.git
cd airsonos
npm install -g --unsafe-perm

LIBS_DIR="`npm list -g | head -n 1`"

curl -sL https://raw.githubusercontent.com/Townk/docker-airsonos/master/logicalDevice.js > $LIBS_DIR/node_modules/airsonos/sonos/lib/logicalDevice.js
