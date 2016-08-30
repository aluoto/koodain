/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Antti Nieminen <antti.h.nieminen@tut.fi>
 */

/* global Slick,devicelib */
'use strict';

angular.module('koodainApp')

  /**
   * Service for querying devices from the device manager.
   *
   * This service does NOT store the list of devices.
   *
   * See bottom of the file for the methods of this service.
   */
  .service('DeviceManager', function ($http, $resource, $q) {

    // list of IDs os selected devices and applications based on device query and app query
    // in the form of :  {devId:[appID, appId], devId: [appId, appId]}
    var selectedNodes = {};

    function matchesId(id, device) {
      return device.id == id;
    }

    function matchesTag(tag, device) {
      return device.type == tag;
    }

    function matchesClasses(cl, device) {
      if (!cl) { return true; }
      for (var i=0; i < cl.length; i++) {
        if (!device.classes || device.classes.indexOf(cl[i]) === -1) {
          return false;
        }
      }
      return true;
    }

    function matchesPseudo(pseudo, device) {
      if (pseudo.key === 'not') {
        // TODO: doesn't work for apps!
        return !matches(device, pseudo.value);
      }
      return true;
    }

    function matchesPseudos(pseudos, device) {
      if (!pseudos) { return true; }
      for (var i=0; i<pseudos.length; i++) {
        if (!matchesPseudo(pseudos[i], device)) {
          return false;
        }
      }
      return true;
    }

    function matchesPart(part, device) {
      if (part.tag && part.tag!=='*' && !matchesTag(part.tag, device)) {
        return false;
      }
      if (!matchesClasses(part.classList, device)) {
        return false;
      }
      if (part.id && !matchesId(part.id, device)) {
        return false;
      }
      if (!matchesPseudos(part.pseudos, device)) {
        return false;
      }
      if (part.attributes && !matchesAttrs(part.attributes, device)) {
        return false;
      }
      return true;
    }

    function matchesAttrs(attrs, device) {
      for (var i=0; i<attrs.length; i++) {
        if (!matchesAttr(attrs[i], device)) {
          return false;
        }
      }
      return true;
    }

    function matchesAttr(attr, device) {
      return attr.test(device[attr.key]);
    }

    function matchesExpr(expr, device) {
      for (var i=0; i < expr.length; i++) {
        if (!matchesPart(expr[i], device)) {
          return false;
        }
      }
      return true;
    }

    function matchesApp(app, query) {
      var exprs = query.expressions;
      for (var i=0; i < exprs.length; i++) {
        if (matchesExpr(exprs[i], app)) {
          return true;
        }
      }
      return false;
    }

    function matchesAppQuery(device, query, devicequery) {
      if (typeof query === 'string') {
        query = Slick.parse(query);
      }

      if (!query) {
        return [];
      }

      var apps = device.apps;

      if (!apps) {
        return false;
      }

      var flag = false;
      for (var i=0; i<apps.length; i++) {
        if (matchesApp(apps[i], query)) {
          if(!devicequery && selectedNodes.devices.indexOf(device.id) == -1){
            selectedNodes.devices.push(device.id);
          }
          selectedNodes.apps.push(apps[i].id);
          flag = true;
          //return true;
        }
      }
      //return false;
      return flag;
    }

    function matchesDeviceQuery(device, query) {
      if (typeof query === 'string') {
        query = Slick.parse(query);
      }

      if (!query) {
        return [];
      }

      var exprs = query.expressions;
      for (var i=0; i < exprs.length; i++) {
        if (matchesExpr(exprs[i], device)) {
          selectedNodes.devices.push(device.id);
          return true;
        }
      }
      return false;
    }

    function matches(device, devicequery, appquery) {
      if (devicequery && !matchesDeviceQuery(device, devicequery)) {
        return false;
      }
      if (appquery && !matchesAppQuery(device, appquery, devicequery)) {
        return false;
      }
      return true;
    }

    function filter(devs, devicequery, appquery) {
      selectedNodes = { devices: [], apps: [] };

      if (!devicequery && !appquery) {
        return selectedNodes;
      }

      /*return  Object.keys(devs).filter(function(id) {
        return matches(devs[id], devicequery, appquery);
      });*/

      for(var devId in devs){
        matches(devs[devId], devicequery, appquery);
      }

      return selectedNodes;
    }

    var N = 100;
    var latestDeviceId = 0;

    function randomClasses() {
      var classes = ['canDoSomething', 'hasSomeProperty', 'isSomething'];
      var cls = classes.filter(function() { return Math.random() < 0.5; });
      cls.push('mock');
      cls.push(['development', 'production'][Math.floor(Math.random()*3)]);
      return cls;
    }

    function randomAppNames() {
      var names = [];
      if (Math.random() < 0.2) {
        names.push('playSound');
      }
      if (Math.random() < 0.2) {
        names.push('measureTemperature');
      }
      return names;
    }

    var latestAppId = 500000;
    function randomApps() {
      return randomAppNames().map(function(a) {
        return {name: a, id: ++latestAppId};
      });
    }

    function randomLocation() {
      return 'TF11' + Math.floor(Math.random()*10);
    }

    function randomDevice() {
      var classes = randomClasses();
      var id = 'mock' + (++latestDeviceId);
      return {
        id: id,
        name: id,
        classes: classes,
        apps: randomApps(classes),
        location: randomLocation(),
      };
    }

    function randomDevices(){
      return $q(function(resolve, reject){
        $http({
          method: 'GET',
          url: '/api/visualdevices'
        }).then(function(jsonDevs){
          //console.log(jsonDevs.data);
          var devsArr = jsonDevs.data;
          var devices = {};
          for (var i=0; i<devsArr.length; i++) {
            // add coordination manually since it is not included in json file
            devsArr[i].coords = {x:(i%10)*200, y:Math.floor(i/10)*200};
            var d = devsArr[i];
            devices[d.id] = d;
          }
          resolve(devices);
        });
      });
    }

    /*function randomDevices() {
      var devices = {};
      for (var i=0; i<N; i++) {
        var d = randomDevice();
        devices[d.id] = d;
      }      
      return devices;
    }*/

    function fetchApps(device) {
      $http({
        method: 'GET',
        url: device.url + '/app'
      }).then(function(res) {
        device.apps = res.data;
      });
    }

    function addMockDevicesTo(devs) {
      //return $q(function(resolve, reject){
        return randomDevices().then(function(rand){
         // console.log("1");
         // console.log(rand);
          for (var i in rand) {
            devs[i] = rand[i];
          }
          return devs;
          //resolve();
          //resolve("2");
        });
      //});
      /*var rand = randomDevices();
      for (var i in rand) {
        devs[i] = rand[i];
      }
      //console.log(devs);
      return devs;*/
    }

    /**
     * The service returns a function that takes a device manager URL as a parameter.
     * The function returns an object with the methods documented below.
     */
    return function (deviceManagerUrl) {
      var dm = devicelib(deviceManagerUrl);
      function queryDevices(deviceQuery, appQuery) {
        return dm.devices(deviceQuery, appQuery);
      }

      return {
        /**
         * Queries devices from the device manager.
         *
         * Takes 2 parameters: deviceQuery and appQuery.
         * Both parameters are optional.
         */
        queryDevices: queryDevices,

        /**
         * Filters a list of devices based on query.
         *
         * This does NOT make a request to the device manager;
         * the given list of devices is filtered locally.
         *
         * Takes 3 parameters:
         * - list of devices
         * - device query
         * - app query
         *
         * Returns a list of devices that match the query/queries.
         */
        filter: filter,

        /**
         * Adds some mock devices to the device list given as parameter.
         */
        addMockDevicesTo: addMockDevicesTo,
      };
    };
  });
