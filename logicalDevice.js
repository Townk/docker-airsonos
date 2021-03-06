var async = require('async'),
    Sonos = require('./sonos').Sonos,
    sonosSearch = require('./sonos').search,
    util = require('util'),
    url = require('url'),
    request = require('request');

function LogicalDevice(devices, coordinator, groupId) {
    if (devices.length === 0) {
        throw new Error('Logical device must be initialized with at least one device (' + devices.length + ' given)');
    }

    var coordinatorDevice = coordinator || devices[0];

    Sonos.call(this, coordinatorDevice.host, coordinatorDevice.port);
    var sonosDevices = devices.map(function (device) {
        return new Sonos(device.host, device.post);
    });

    this.devices = sonosDevices;
    this.groupId = groupId;
}

util.inherits(LogicalDevice, Sonos);

LogicalDevice.prototype.initialize = function (cb) {
    async.forEach(this.devices, function (device, done) {
        device.initialize(done);
    }, cb);
};

LogicalDevice.prototype.destroy = function (cb) {
    async.forEach(this.devices, function (device, done) {
        device.destroy(done);
    }, cb);
};

LogicalDevice.prototype.setVolume = function (volume, cb) {
    this.getVolume(function (oldVolume) {

        var diff = volume - oldVolume;

        async.forEach(this.devices, function (device, done) {
            var oldDeviceVolume = device.state.volume;
            var newDeviceVolume = oldDeviceVolume + diff;

            newDeviceVolume = Math.max(newDeviceVolume, 0);
            newDeviceVolume = Math.min(newDeviceVolume, 100);

            device.setVolume(newDeviceVolume, done);

        }, cb);

    }.bind(this));
};

LogicalDevice.prototype.getVolume = function (cb) {

    var sum = 0;

    this.devices.forEach(function (device) {
        sum += device.state.volume || 0;
    });

    cb(sum / this.devices.length);
};

/**
 * Create a Search Instance (emits 'DeviceAvailable' with a found Logical Sonos Component)
 * @param  {Function} Optional 'DeviceAvailable' listener (sonos)
 * @return {Search/EventEmitter Instance}
 */
var search = function (callback) {
    var search = sonosSearch();

    search.once('DeviceAvailable', function (device) {
        device.getTopology(function (err, topology) {
            if (err) callback(err);
            else {

                var devices = topology.zones;
                var groups = {};

                // bucket devices by groupid
                async.forEach(devices, function (device, done) {
                        //if device is not a coordinator, we need to ignore it
                        if (device.coordinator === 'false' || device.name === 'BRIDGE' || device.name === 'BOOST') {
                            done(null);
                        } else {
                            //we need to poll the device to make sure it's not a Bridge or a Boost - we need to filter these devices out
                            request({
                                uri: device.location,
                                method: 'GET',
                            }, function (err, res, body) {
                                //check the response for Sonos BRIDGE or Sonos BOOST
                                if (!err && (body.search('<modelDescription>Sonos BRIDGE</modelDescription>') < 0) && (body.search('<modelDescription>Sonos BOOST</modelDescription>') < 0)) {
                                    //if we pass the filter, go ahead and add the device to the list
                                    if (!groups[device.group]) groups[device.group] = {
                                        members: []
                                    };
                                    var parsedLocation = url.parse(device.location);
                                    var sonosDevice = new Sonos(parsedLocation.hostname, parsedLocation.port);
                                    if (device.coordinator === 'true') groups[device.group].coordinator = sonosDevice;
                                    groups[device.group].members.push(sonosDevice);
                                };
                                done(null);
                            });
                        }
                    },
                    function (err) {
                        //when we're done with all the device filtering, let's initialze all of the logical devices brefore callback
                        var logicalDevices = Object.keys(groups).map(function (groupId) {
                            var group = groups[groupId];
                            return new LogicalDevice(group.members, group.coordinator, groupId);
                        });

                        async.forEach(logicalDevices, function (device, done) {
                            device.initialize(function (err) {
                                if (err) done(err);
                                else {
                                    done(null);
                                }
                            });
                        }, function (err) {
                            if (err) callback(err);
                            else {
                                callback(null, logicalDevices);
                            }
                        });

                    });

            }
        });
    });

    return search;
};

module.exports = LogicalDevice;
module.exports.search = search;