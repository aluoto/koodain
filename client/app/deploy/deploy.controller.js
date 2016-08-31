/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Antti Nieminen <antti.h.nieminen@tut.fi>
 */

/* global devicelib */
'use strict';

angular.module('koodainApp')

  /**
   * Controller for the deploy view.
   */
  .controller('DeployCtrl', function ($scope, $http, $resource, $uibModal, Notification, VisDataSet, DeviceManager, deviceManagerUrl, $stateParams, $q) {

  var Project = $resource('/api/projects/:project');
  Project.query(function(projects){
    $scope.projects = projects;
  });

  $scope.deviceManagerUrl = deviceManagerUrl;
    
  var deviceManager = DeviceManager(deviceManagerUrl);

  // Groups for Vis.js network
  // http://visjs.org/docs/network/groups.html
  var visGroups = {
    device: {
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: '\uf233',
        size: 50,
        color: 'gray'
      },
      // comment the line below if you want to enable dragging
      fixed: true
    },
    'device:selected': {
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: '\uf233',
        size: 85,
        color: 'purple'
      },
      // comment the line below if you want to enable dragging
      fixed: true
    },
    app:{
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: '\uf059',
        size: 50,
        color: 'black'
      }
    },
    'app:selected':{
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: '\uf059',
        size: 70,
        color: 'green'
      }
    }
  };

  function groupForApp(app) {
    return 'app';
  }

  function groupForDevice() {
    return 'device';
  }

  /// Returns a Vis.js node for the device
  function nodeFromDevice(device) {
    var id = device.id;
    var n = {
      id: id,
      label: device.name || id,
      title: generateDeviceTooltip(device),
      x: device.coords.x,
      y: device.coords.y,
      group: groupForDevice()
    };
    return n;
  }

  // tool tip for a device
  var generateDeviceTooltip = function(device){

    var tooltip = "<div class='panel panel-success' style='margin-bottom:0px'>"+
        "<div class='panel-heading'>"+
          "<h3 class='panel-title'>device</h3>"+
        "</div>"+
        "<div class='panel-body' style='padding-top: 0px; padding-bottom: 0px'>"+
          "<table class='table' style='border: none; margin-bottom:1px'>"+
            "<tr>"+
              "<td>id</td>"+
              "<td>" + device.id + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>name</td>"+
              "<td>" + device.name + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>capabilities</td>"+
              "<td>" + device.classes.join(", ") + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>location</td>"+
              "<td>" + device.location + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>url</td>"+
              "<td>" + device.url + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>coordination</td>"+
              "<td>" + device.coords.x + "," + device.coords.y + "</td>"+
            "</tr>"+
          "</table>"+
        "</div>"+
      "</div>";

    return tooltip;
  }

  // tool tip for an app
  var generateAppTooltip = function(app){

    var apis = app.hasOwnProperty("applicationInterfaces") ? app.applicationInterfaces.join(", ") : "";
    var status = app.hasOwnProperty("status") ? app.status : "";
    var version = app.hasOwnProperty("version") ? app.version : "";
    var description = app.hasOwnProperty("description") ? app.description : "";

    var tooltip = "<div class='panel panel-success' style='margin-bottom:0px'>"+
        "<div class='panel-heading'>"+
          "<h3 class='panel-title'>application</h3>"+
        "</div>"+
        "<div class='panel-body' style='padding-top: 0px; padding-bottom: 0px'>"+
          "<table class='table' style='border: none; margin-bottom:1px'>"+
            "<tr>"+
              "<td>id</td>"+
              "<td>" + app.id + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>name</td>"+
              "<td>" + app.name + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>interfaces</td>"+
              "<td>" + apis + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>status</td>"+
              "<td>" + status + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>version</td>"+
              "<td>" + version + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>description</td>"+
              "<td>" + description +"</td>"+
            "</tr>"+
          "</table>"+
        "</div>"+
      "</div>";

    return tooltip;
  }

  /// Returns a Vis.js node for the app
  function nodeFromApp(app) {
    var n = {
      id: 'app:' + app.id,
      label: app.name,
      group: groupForApp(),
      title: generateAppTooltip(app)//,
    };
    return n;
  }

  // Convert the list to an object with device.id as key
  function deviceListAsObject(devs) {
    var obj = {};
    for (var i=0; i<devs.length; i++) {
      // add id property to the device
      devs[i].id = devs[i]._id;
      // add coordination manually since it is not included in json file
      devs[i].coords = {x:(i%10)*200, y:(Math.floor(i/10)+10)*200};
      var d = devs[i];
      obj[d.id] = d;
    }
    return obj;
  }

  // These will be assigned when devices are loaded.
  var allDevices = [], nodes, edges;


  // This counter is used for crawling the camera between selected devices
  var focusedNodeIndex = -1;
  $scope.camera = {
    // Zooms out so all node fit on the canvas
    fit : function(){
      network.fit();
    },
    // Zooms out so all selected node fit on the canvas
    fitOnSelectedNodes : function(){
      // if only one device node is selected
      if(selDevIds.length == 1){
        network.focus(selDevIds[0], {scale:1});
      } else {
        network.fit({nodes: selDevIds});
      }
    },
    // if the number od selected nodes are more than 1 then crawling is meaningful
    checkCrawling: function(){
      if(selDevIds.length > 1){
        focusedNodeIndex = 0;
        $scope.isCrawlingPossible = true;
      } else {
        focusedNodeIndex = -1;
        $scope.isCrawlingPossible = false;
      }
    },
    crawl : function(){
      if(focusedNodeIndex >= 0 && focusedNodeIndex <= selDevIds.length) {
        // crawling has completed one circle
        if(focusedNodeIndex == selDevIds.length){
          Notification.info({message:"Crawling started again!", delay:1000});
        }
        focusedNodeIndex %= selDevIds.length;
        network.focus(selDevIds[focusedNodeIndex], {scale:1});
        focusedNodeIndex++; 
      }
    }

  };

  $scope.filterSelApp = function(app){
    if( $scope.hasOwnProperty('appquery') && $scope.appquery.length != 0 && selAppIds.indexOf("app:" + app.id) == -1){
      return false;
    }
    return true;
  }

  var selDevIds = [];
  var selAppIds = [];

  function select(devIds, appIds) {

    nodes.update(selDevIds.map(function(id) {
      return {
        id: id,
        group: groupForDevice(allDevices[id])
      };
    }));
    nodes.update(devIds.map(function(id) {
      return {
        id: id,
        group: groupForDevice(allDevices[id]) + ':selected'
      };
    }));

    nodes.update(selAppIds.map(function(id) {
      return {
        id: id,
        group: groupForApp()
      };
    }));
    nodes.update(appIds.map(function(id) {
      return {
        id: id,
        group: groupForApp() + ':selected'
      };
    }));

    selDevIds = devIds;
    selAppIds = appIds;

    var selDevs = selDevIds.map(function(id) {
      return allDevices[id];
    });

    $scope.selectedDevices = selDevs;

    $scope.camera.fit();
    $scope.camera.checkCrawling();
  }

  // The Vis.js network object, assigned on Vis.js onload event
  var network;

  // Select devices based on what's in device query + app query fields
  // This is called every time either of them changes
  function updateSelection() {

    // list of ids of queried apps
    var queriedApps = [];
    // list of ids of queried devices
    var queriedDevs = [];
    // ids of all queried apps and devices
    var queriedAppsAndDevs = [];
    // ids of devices that are hosting queried apps (are the result of querying apps)
    // and are not the result of querying devices. 
    var noQueriedDevs = [];

    // if there is any query to query apps or devices
    if($scope.devicequery || $scope.appquery){
      // query apps OR devices
      deviceManager.queryDevicess($scope.devicequery, $scope.appquery, 'or')
        .then(function(devices){
          devices.forEach(function(device){
            queriedDevs.push(device._id);
            if(device.hasOwnProperty('matchedApps')){
              // the device which is hosting the queried apps
              if(!device.isQueried){
                noQueriedDevs.push('#' + device._id);
              }
              var matchedAppIds = device.matchedApps.map(function(app){
                return "app:" + app.id;
              });
              queriedApps.push.apply(queriedApps, matchedAppIds);
            }
          });

          if(noQueriedDevs.length > 0) {
            if($scope.devicequery) {
              $scope.devicequery = $scope.devicequery + ',' + noQueriedDevs.join(',');
            } else {
              $scope.devicequery = noQueriedDevs.join(',');
            }
          }
          queriedAppsAndDevs = queriedDevs.concat(queriedApps);
          findSelectedDevCaps(queriedDevs);
          network.selectNodes(queriedAppsAndDevs);
          select(queriedDevs, queriedApps);
        }).catch(function(err){
          findSelectedDevCaps(queriedDevs);
          network.selectNodes(queriedAppsAndDevs);
          select(queriedDevs, queriedApps);
        });
    } else {
      findSelectedDevCaps(queriedDevs);
      network.selectNodes(queriedAppsAndDevs);
      select(queriedDevs, queriedApps);
    }
  }


  // Vis.js events
  $scope.graphEvents = {
    onload: function(_network) {
      network = _network;
      $scope.$watch('devicequery', updateSelection);
      $scope.$watch('appquery', updateSelection);
    },
    selectNode: selectClick,
    deselectNode: selectClick
  };

  $scope.loadDevices = function () {
    return deviceManager.queryDevicess().then(function(devices) {
      allDevices = deviceListAsObject(devices);
      // if you want to remove visual devices,
      // comment this line and uncomment the next line
      //return deviceManager.addMockDevicesTo(allDevices);
      return allDevices; // a promise can return a synchroous value
    }).then(function(devs){
      allDevices = devs;
      updateNodesAndEdges();
      //$scope.$apply();
      return "done";
    });
  }
  
  // loading of the devices
  $scope.loadDevices();

  // Update Vis.js nodes and edges
  // look at setTheData() function http://visjs.org/examples/network/data/datasets.html
  function updateNodesAndEdges() {
      var edgesArray = [];
      var nodesArray = Object.keys(allDevices).map(function(id) {
        return nodeFromDevice(allDevices[id]);
      });

      for (var i in allDevices) {
        var d = allDevices[i];
        var apps = d.apps;
        if (apps) {
          nodesArray.push.apply(nodesArray, apps.map(nodeFromApp));
          //nodes.add(apps.map(nodeFromApp));
          /* jshint -W083 */
          // Edge from each app to the device it's in
          edgesArray.push.apply(edgesArray, apps.map(function(app) {
            return {
              from: 'app:' + app.id,
              to: d.id,
              length: 50
            };
          }));
        }
      }
      nodes = new VisDataSet(nodesArray);
      edges = new VisDataSet(edgesArray);
      $scope.graphData = {
        nodes: nodes,
        edges: edges
      };
    }


  //$scope.loadDevices = loadDevices;

  // Vis.js options
  // http://visjs.org/docs/network/#options
  $scope.graphOptions = {
    groups: visGroups,
    interaction: {
      multiselect: true
    }
  };

  function isAppNodeId(nodeId) {
    // App node ids start with app:
    return nodeId && nodeId.slice(0,4) === 'app:';
  }

  function isDeviceNodeId(nodeId) {
    // There are only devices and apps (for now)
    return !isAppNodeId(nodeId);
  }

  // When the user clicks on the Vis.js network,
  // construct a comma-separated list of selected device id to be used as query.
  function selectClick(params) {

    var selDevices = params.nodes.filter(isDeviceNodeId);
    var selApps = params.nodes.filter(isAppNodeId);

    $scope.deselectProject();

    var lastModifiedNodeId = null;
    // if no node (either device or app) is selected
    if(params.nodes.length === 0){
      $scope.devicequery = "";
      $scope.appquery = "";
    // if a node is deselected
    } else if (params.hasOwnProperty('previousSelection')) {
      // find the deselected node
      lastModifiedNodeId = findDeselectedNode(params.nodes, params.previousSelection.nodes);
    } else {
      // find the selected node
      lastModifiedNodeId = params.nodes[params.nodes.length - 1];
    }
    
    // if the selected or deselected node is a device, modify query of device
    if(isDeviceNodeId(lastModifiedNodeId)){
      $scope.devicequery = selDevices.map(function(id) { return '#'+id; }).join(',');
    // if the selected or deselected node is an app, modify query of app
    } else if(isAppNodeId(lastModifiedNodeId)){
      $scope.appquery = selApps.map(function(id) { return '#'+id.slice(4,id.length); }).join(',');
    }

    $scope.$apply();  // Needed?
  }
  
  function findDeselectedNode(newSelection, oldSelection){
    return oldSelection.filter(function(device){
      return newSelection.indexOf(device) == -1;
    })[0];
  }

  // selected device capabilities : an array that represents device capabilities of selected devices
  var selDevCaps = [];

  function findSelectedDevCaps(sel){
    selDevCaps = sel.map(function(devId){
      return allDevices[devId].classes;
    });
  }

  // Returns a promise for getting the device capabilities
  // mentioned in liquidiot.json file of the the project
  function getDevCapsPromise(project) {
    return $http({
      method: 'GET',
      url: '/api/projects/' + project.name + '/files/liquidiot.json'
    }).then(function(res){
      res.name = project.name;
      return res;
    });
  }

  // A list of "deployment objects".
  // Currently the staged deployment is only stored here in this controller;
  // they are lost on page reload...
  $scope.deployments = [];

  $scope.openManageAppsModal = function() {
    $uibModal.open({
      controller: 'ManageAppsCtrl',
      templateUrl: 'manageapps.html',
      resolve: {
        projects: function(){
          return Promise.all($scope.projects.map(getDevCapsPromise));
        },
        data: function() {
          return {
            devices: $scope.selectedDevices,
            devicequery: $scope.devicequery,
            appquery: $scope.appquery,
            selectedProject: $scope.selectedProject,
            selectedDeviceCapabilities: selDevCaps
          }; 
        },
      }
    }).result.then(function(deployment) {
      $scope.deployments.push(deployment);
    });
  };

  $scope.verifyDeployment = function() {
    $uibModal.open({
      controller: 'VerifyDeploymentCtrl',
      templateUrl: 'verifydeployment.html',
      resolve: {
        deployments: function() { return $scope.deployments; },
      }
    }).result.then(function() {
      $scope.deployments = [];
      $scope.loadDevices();
    });
  };

  $scope.discardDeployment = function() {
    $scope.deployments = [];
  };


  $scope.openLogModal = function(device, app) {
    $uibModal.open({
      controller: 'AppLogCtrl',
      templateUrl: 'applog.html',
      resolve: {
        device: device,
        app: app,
      }
    }).result.then(null, function() {
      clearInterval(app._logInterval);
    });
  };

  // "Piping" HTTP request through server.
  // This is necessary for some network configurations...
  function devicePipeUrl(url) {
    return '/api/pipe/'  + url;
  }

  $scope.setAppStatus = function(device, app, status) {
    var url = device.url + '/app/' + app.id;
    return $http({
      url: devicePipeUrl(url),
      method: 'PUT',
      data: {status: status},
    }).then(function(response) {
      // This is a bit of quickndirty way to update app,
      // would be better to load it from the server for realz...
      //app.status = response.data.status;
      $scope.loadDevices();
    }, function(error){
      Notification.error("Connection to the application was not succeccfull.");
    });
  };

  $scope.removeApp = function(device, app) {
    //console.log(device);
    var url = device.url + '/app/' + app.id;
    return $http({
      url: devicePipeUrl(url),
      method: 'DELETE',
    }).then(function() {
          // do not now why loaddevices should be called two time to take effect !!!
          $scope.loadDevices().then(function(){
            $scope.loadDevices();
          });
    }, function(error){
      Notification.error("Connection to the application was not succeccfull.");
    });
  };

  $scope.deselectProject = function(){
    // model for project select list
    $scope.selectedProject = null;
  }

  $scope.deselectProject();

  $scope.$watch('selectedProject', function(){
    $scope.selectDevicesForProject();
  });

  $scope.selectDevicesForProject = function() {
    if($scope.selectedProject){
      // Read the liquidiot.json and construct a query based on its
      // 'deviceCapabilities' field.
      $http({
        method: 'GET',
        url: '/api/projects/' + $scope.selectedProject.name + '/files/liquidiot.json'
      }).then(function(res) {
        var json = JSON.parse(res.data.content);
        var dcs = json['deviceCapabilities'];
        // free-class means all devices, so we remove it from device capabilities.
        // if array becomes empty we query all devices
        // otherwise we query the remaining devices
        var index = dcs.indexOf("free-class");
        if(index != -1){
          dcs.splice(index, 1);
        }
        if (!dcs || !dcs.length) {
          // No deviceCapabilities, query everything *
          $scope.devicequery = '*';
        }
        else {
          $scope.devicequery = '.' + dcs.join('.');
        }
      });
    };
  }

  if($stateParams.project){
    Project.get({project:$stateParams.project}, function(project){
      $scope.selectedProject = project;
      $scope.selectDevicesForProject();
    });
  }

})

/**
 * Controller for managing (deploying) apps modal dialog.
 */
.controller('ManageAppsCtrl', function($scope, $resource, $http, $uibModalInstance, data, projects) {

  var selDevCaps = data.selectedDeviceCapabilities;
  $scope.devices = data.devices;
  $scope.devicequery = data.devicequery;
  $scope.appquery = data.appquery;

  // checks if one array is subset of another array
  var isSubset = function(arr1, arr2){
    return arr1.every(function(value){
      return arr2.indexOf(value) >= 0;
    });
  }

  // checks if device capabilities listed in the project (liquidiot.json file)
  // is subset of capabilities of every selected device.
  var isSubsetOfAll = function(dcs){
    return selDevCaps.every(function(devCaps){
      return isSubset(dcs, devCaps);
    });
  }

  // selecting projects based on the selected device capabilities
  $scope.projects = projects.filter(function(project){
    var json = JSON.parse(project.data.content);
    var dcs = json['deviceCapabilities'];
    // free-class means all devices, so we remove it from device capabilities.
    // if array becomes empty 
    // otherwise we query the remaining devices
    var index = dcs.indexOf("free-class");
    if(index != -1){
      dcs.splice(index, 1);
    }
    if (!dcs || !dcs.length) {
      // No deviceCapabilities, can be deployed to all devices
      return true;
    }
    else if (isSubsetOfAll(dcs)){
      return true;
    } else {
      return false;
    }
  });

  if(data.selectedProject){
    $scope.selectedProject = $scope.projects.filter(function(project){
      return project.name == data.selectedProject.name;
    })[0];
  }

  $scope.cancel = function() {
    $uibModalInstance.dismiss('cancel');
  };
  $scope.done = function() {
    // Construct a "deployment object"
    // TODO: we could have various tasks to be done on deployment,
    // currently the only kind of task is to deploy app.
    var deployment = {
      devicequery: data.devicequery,
      appquery: data.appquery,
      project: $scope.selectedProject.name,
      numApproxDevices: data.devices.length,
      n: $scope.allDevices || !$scope.numDevices ? 'all' : $scope.numDevices,
      removeOld: $scope.removeOld,
      selectedDevices: data.devices
    };
    $uibModalInstance.close(deployment);
  };
})

/**
 * Controller for the verify deployment modal dialog.
 */
  .controller('VerifyDeploymentCtrl', function($scope, $http, $resource, $uibModalInstance, Notification, deployments, deviceManagerUrl) {

  $scope.deployments = deployments;

  $scope.cancel = function() {
    $uibModalInstance.dismiss('cancel');
  };
  $scope.done = function() {
    $uibModalInstance.close();
  };

  // Returns a promise for deploying the project to the device.
  function deployDevicePromise(device, projectName) {
    var url = device.url;
    Notification.info('Deploying ' + projectName + ' to ' + url);
    return $http({
      method: 'POST',
      url: '/api/projects/' +projectName + '/package',
      data: {deviceUrl: url},
    });
  }

  // Returns a promise for executing the deployment object.
  function deployPromise(deployment) {
    // Promise.all succeeds iff all the promises succeed.
    // TODO: what to do on (partially) unsuccessful deployment??!?!?!
    return Promise.all(deployment.selectedDevices.map(function(d) {
      return deployDevicePromise(d, deployment.project);
    }));
  }

  $scope.deploy = function() {
    var deps = $scope.deployments;
    if (!deps.length) {
      return;
    }

    $scope.deploying = true;

    Promise.all(deps.map(deployPromise)).then(function() {
      delete $scope.deploying;
      Notification.success('Deployment successful!');
      $uibModalInstance.close();
    },
    function(err) {
      // At least one of the deployment tasks failed.
      // TODO: what to do on (partially) unsuccessful deployment??!?!?!
      delete $scope.deploying;
      Notification.error('Deployment failed!');
      $uibModalInstance.dismiss('cancel');
    });
  };
})
/**
 * Controller for showing application log.
 */
.controller('AppLogCtrl', function($scope, $http, $uibModalInstance, Notification, device, app) {

    // TODO: refactor, this is needed in 2(?) controllers...
    function devicePipeUrl(url) {
      return '/api/pipe/'  + url;
    }

    $scope.device = device;
    $scope.app = app;
    $scope.cancel = function() {
      $uibModalInstance.dismiss('cancel');
    };
    app._logInterval = setInterval(function() {
      var url = device.url + '/app/' + app.id + '/log';
      $http({
        method: 'GET',
        url: devicePipeUrl(url),
      }).then(function(response) {
        $scope.log = response.data;
      },function(error){
        $scope.cancel();
        Notification.error("Connection to the application was not successful.");
      });
    }, 2000);
  });

