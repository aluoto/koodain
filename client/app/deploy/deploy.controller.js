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


  // Returns a promise for getting the device capabilities
  // mentioned in liquidiot.json file of the the project
  function getDevCapsPromise(project) {
    //return $q(function(resolve, reject){
      return $http({
        method: 'GET',
        url: '/api/projects/' + project.name + '/files/liquidiot.json'
      }).then(function(res){
        res.name = project.name;
        //resolve(res);
        return res;
      });
    //});
  }

  var Project = $resource('/api/projects/:project');
  //$scope.projects = Project.query();
  Project.query(function(projects){
    $scope.projects = projects;
    //Promise.all($scope.projects.map(getDevCapsPromise)).then(function(v){
      //console.log(v);
    //});
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
        color: 'gray',
      },
      // comment the line below if you want to enable dragging
      fixed: true
      //physics: false
    },
    'device:selected': {
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: '\uf233',
        size: 85,
        color: 'purple',
      },
      //physics: false
      // comment the line below if you want to enable dragging
      fixed: true
    }
  };

  /// Returns a Vis.js group based on app name
  /// If the group doesn't exist, it's created in the visGroups object.
  function createGroup(name) {
    var codes = {
      playSound: '\uf028',
      measureTemperature: '\uf0e4',
    };

    //console.log(name);

    if (!(name in codes)) {
      //console.log(name);
      name = 'default';
      //console.log(name);
    }

    if (name in visGroups) {
      //console.log(visGroups);
      //console.log('yes');
      return name;
    }

    //console.log(visGroups);

    var code = codes[name];
    if (!code) {
      code = '\uf059';
    }

    visGroups[name] = {
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: code,
        size: 50,
        color: 'black',
      }
    };
    visGroups[name+':selected'] = {
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: code,
        size: 50,
        color: 'purple',
      }
    };
    return name;
  }

  function groupForApp(app) {
    return createGroup(app.name);
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
      title: generateTooltip(device),
      x: device.coords.x,
      y: device.coords.y,
      group: groupForDevice()
    };
    return n;
  }

  var generateTooltip = function(device){

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

  /// Returns a Vis.js node for the app
  function nodeFromApp(app) {
    var n = {
      id: 'app:' + app.id,
      label: app.name,
      group: groupForApp(app),
      selectable: false
    };
    return n;
  }

  // Convert the list to an object with device.id as key
  function deviceListAsObject(devs) {
    var obj = {};
    for (var i=0; i<devs.length; i++) {
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
      if(selectedNodeIds.length == 1){
        network.focus(selectedNodeIds[0], {scale:1});
      } else {
        network.fit({nodes: selectedNodeIds});
      }
    },
    // if the number od selected nodes are more than 1 then crawling is meaningful
    checkCrawling: function(){
      if(selectedNodeIds.length > 1){
        focusedNodeIndex = 0;
        $scope.isCrawlingPossible = true;
      } else {
        focusedNodeIndex = -1;
        $scope.isCrawlingPossible = false;
      }
    },
    crawl : function(){
      if(focusedNodeIndex >= 0 && focusedNodeIndex <= selectedNodeIds.length) {
        // crawling has completed one circle
        if(focusedNodeIndex == selectedNodeIds.length){
          Notification.info({message:"Crawling started again!", delay:1000});
        }
        focusedNodeIndex %= selectedNodeIds.length;
        network.focus(selectedNodeIds[focusedNodeIndex], {scale:1});
        focusedNodeIndex++; 
      }
    }

  };

  var focusedNodeIndex = -1;
  $scope.camera = {
    // Zooms out so all node fit on the canvas
    fit : function(){
      network.fit();
    },
    // Zooms out so all selected node fit on the canvas
    fitOnSelectedNodes : function(){
      if(selectedNodeIds.length == 1){
        network.focus(selectedNodeIds[0], {scale:1});
      } else {
        network.fit({nodes: selectedNodeIds});
      }
    },
    checkCrawling: function(){
      if(selectedNodeIds.length > 1){
        focusedNodeIndex = 0;
        $scope.isCrawlingPossible = true;
      } else {
        focusedNodeIndex = -1;
        $scope.isCrawlingPossible = false;
      }
    },
    crawl : function(){
      if(focusedNodeIndex >= 0 && focusedNodeIndex <= selectedNodeIds.length) {
        if(focusedNodeIndex == selectedNodeIds.length){
          Notification.info({message:"Crawling started again!", delay:1000});
        }
        focusedNodeIndex %= selectedNodeIds.length;
        //console.log("focusedNodeId: " + focusedNodeIndex);
        network.focus(selectedNodeIds[focusedNodeIndex], {scale:1});
        focusedNodeIndex++; 
      }
    }

  };

  // List of ids of the nodes that are currently selected
  var selectedNodeIds = [];

  function select(ns) {
    nodes.update(selectedNodeIds.map(function(id) {
      return {
        id: id,
        group: groupForDevice(allDevices[id])
      };
    }));
    nodes.update(ns.map(function(id) {
      return {
        id: id,
        group: groupForDevice(allDevices[id]) + ':selected'
      };
    }));
    //console.log("ns: " + ns);
    //console.log("selectedNodeIds:" + selectedNodeIds);
    selectedNodeIds = ns;
    $scope.selectedDevices = selectedNodeIds.map(function(id) {
      return allDevices[id];
    });
    //console.log($scope.selectedDevices);
    $scope.camera.fit();
    $scope.camera.checkCrawling();
  }

  // The Vis.js network object, assigned on Vis.js onload event
  var network;

  // Select devices based on what's in device query + app query fields
  // This is called every time either of them changes
  function updateSelection() {
    var sel = deviceManager.filter(allDevices, $scope.devicequery, $scope.appquery);
    //console.log(sel);
    if(sel.length > 0) {
      findSelectedDevCaps(sel);
    }
    network.selectNodes(sel);
    select(sel);
  }


  // Vis.js events
  $scope.graphEvents = {
    onload: function(_network) {
      network = _network;
      $scope.$watch('devicequery', updateSelection);
      //$scope.$watch('appquery', updateSelection);
    },
    selectNode: selectClick,
    deselectNode: selectClick
  };

  // loadDevices
  function loadDevices() {
    deviceManager.queryDevices().then(function(devices) {

      console.log(devices);

      allDevices = deviceListAsObject(devices);
      console.log(allDevices);

      // if you want to remove visual devices,
      // comment this line and uncomment the next line
      //return deviceManager.addMockDevicesTo(allDevices);
      return Promise.resolve(allDevices);
    }).then(function(devs){
      allDevices = devs;
      console.log(allDevices);
      updateNodesAndEdges();
      //updateSelection();
      $scope.$apply();
    });
  }
  
  // loading of the devices
  loadDevices();
  // Update Vis.js nodes and edges
  // look at resetAllNodes() function here http://visjs.org/examples/network/data/datasets.html

  /*function updateNodesAndEdges() {
    nodes.clear();
    edges.clear();

    Object.keys(allDevices).forEach(function(id) {
      nodes.add(nodeFromDevice(allDevices[id]));
    });

    for (var i in allDevices) {
      var d = allDevices[i];
      var apps = d.apps;
      if (apps) {
        nodes.add(apps.map(nodeFromApp));
        /* jshint -W083 */
        // Edge from each app to the device it's in
        /*edges.add(apps.map(function(app) {
          return {
            from: 'app:' + app.id,
            to: d.id,
          };
        }));
      }
    }
  }*/

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


  $scope.loadDevices = loadDevices;

  // Vis.js options
  // http://visjs.org/docs/network/#options
  $scope.graphOptions = {
    groups: visGroups,
    interaction: {
      multiselect: true
    }/*,
    nodes: {
      fixed:{
        x: true,
        y: true
      }
    }/*,
    /*layout:{
      //randomSeed: 1
    //},
    //physics: false
    /*, nodes:{
      physics: false
    }*/
  };

  function isAppNodeId(nodeId) {
    // App node ids start with app:
    return nodeId.slice(0,4) === 'app:';
  }

  function isDeviceNodeId(nodeId) {
    // There are only devices and apps (for now)
    return !isAppNodeId(nodeId);
  }

  var lastSelectedDevice = null;
  // When the user clicks on the Vis.js network,
  // construct a comma-separated list of selected device id to be used as query.
  function selectClick(params) {
    // TODO: currently only devices can be selected, not apps...
    var selDevices = params.nodes.filter(isDeviceNodeId);
    //lastSelectedDevice = selDevices[selDevices.length - 1];
    /*if(params.previousSelection){
      var oldSelDevices = params.previousSelection.nodes.filter(isDeviceNodeId);
      //findDeselectedDevice(selDevices, oldSelDevices);
    }*/
    //console.log(params);
    findAllSelectedDevCaps(params) 
    $scope.deselectProject();
    $scope.devicequery = selDevices.map(function(id) { return '#'+id; }).join(',');
    $scope.$apply();  // Needed?
  }

  function findDeselectedDevice(newSelection, oldSelection){
    var deselectedDevice =  oldSelection.filter(function(device){
      return newSelection.indexOf(device) == -1;
    });
    //console.log(deselectedDevice);
  }

  var allSelectedDevCaps = [];

  function mergeTwoArrs(arr1, arr2){
    return arr1.concat(arr2.filter(function(element){
      return arr1.indexOf(element) == -1;
    }));
  }

  function mergeArrs(arrs){
    while(arrs.length != 1) {
        arrs[arrs.length - 2] = mergeTwoArrs(arrs[arrs.length - 2], arrs[arrs.length - 1]);
        arrs.splice(arrs.length - 1, 1);
    }
    return arrs[0];
  }

  function findSelectedDevCaps(sel){
    var selectedDevCaps = sel.map(function(devId){
      return allDevices[devId].classes;
    });
    allSelectedDevCaps = mergeArrs(selectedDevCaps);
    //console.log(selectedDevCaps);
  }

  function findAllSelectedDevCaps(params) {

    var selDevices = params.nodes.filter(isDeviceNodeId);
    if(selDevices.length == 0){
      allSelectedDevCaps = [];
    } else if(selDevices.length == 1){
      allSelectedDevCaps = allDevices[selDevices[0]].classes;
    } else if(params.previousSelection){
    } else {
      var selectedDevCaps = allDevices[selDevices[selDevices.length - 1]].classes;
      allSelectedDevCaps = mergeTwoArrs(allSelectedDevCaps, selectedDevCaps);
      //console.log(allSelectedDevCaps);
      //allSelectedDevCaps = allSelectedDevCaps.concat(selectedDevCaps.filter(function(selectedDevCap){
        //return allSelectedDevCaps.indexOf(selectedDevCap) == -1;
      //}));
    }

    //console.log(allSelectedDevCaps);
    //console.log(allDevices[lastSelectedDevice]);
    /*var selectedDevCaps = allDevices[lastSelectedDevice] ? allDevices[lastSelectedDevice].classes : [];
    //console.log(selectedDevCaps);
    allSelectedDevCaps = allSelectedDevCaps.concat(selectedDevCaps.filter(function(selectedDevCap){
      return allSelectedDevCaps.indexOf(selectedDevCap) == -1;
    }));*/
   // console.log(allSelectedDevCaps);
  }

  /*function addAppsNodes(){
    var dm = devicelib(deviceManagerUrl);
    function addAppNodes(deployment){
      dm.devices(deployment.devicequery, deployment.appquery).then(function(devices) {
        //deployment.devices = devices;
        devices.forEach(function(device){
          device.apps.filter(function(app){
            //app.id == 
          });
        });
        console.log(devices);
        console.log(deployment.project);
      });
    }
    $scope.deployments.forEach(addAppNodes);
  }*/

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
          //console.log($scope.projects);
          return Promise.all($scope.projects.map(getDevCapsPromise));
        },
        data: function() {
          return {
            devices: $scope.selectedDevices,
            devicequery: $scope.devicequery,
            appquery: $scope.appquery,
            selectedProject: $scope.selectedProject,
            allSelectedDevCaps: allSelectedDevCaps//,
            //liqjsons: Promise.all($scope.projects.map(getDevCapsPromise))
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
      loadDevices();
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
      app.status = response.data.status;
    }, function(error){
      Notification.error("Connection to the application was not succeccfull.");
    });
  };

  $scope.removeApp = function(device, app) {
    var url = device.url + '/app/' + app.id;
    return $http({
      url: devicePipeUrl(url),
      method: 'DELETE',
    }).then(function() {
      var apps = device.apps;
      for (var i=0; i<apps.length; i++) {
        if(apps[i].id === app.id) {
          apps.splice(i, 1);
          loadDevices();
          return;
        }
      }
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

  //console.log(data.selectedProject);

  var selectedDevCaps = data.allSelectedDevCaps;
  //console.log(selectedDevCaps);

  //$scope.projects = projects;
  $scope.devices = data.devices;
  $scope.devicequery = data.devicequery;
  $scope.appquery = data.appquery;

  // comparing two array, return true if equal, otherwise false
  var isEqual = function(arr1, arr2){
    return (arr1.length == arr2.length) && (arr1.every(function(element, index){ return element === arr2[index]; }));
  }

  // selecting projects based on the selected device capabilities
  $scope.projects = projects.filter(function(project){
    var json = JSON.parse(project.data.content);
    var dcs = json['deviceCapabilities'];
    // free-class means all devices, so we remove it from device capabilities.
    // if array becomes empty we query all devices
    // otherwise we query the remaining devices
    var index = dcs.indexOf("free-class");
    if(index != -1){
      dcs.splice(index, 1);
    }
    //console.log(project.name);
    if (!dcs || !dcs.length) {
      // No deviceCapabilities, query everything *
      return true;
    }
    else if (isEqual(dcs, selectedDevCaps)){
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


  //$scope.selectedProject = data.SelectedProject;
  //console.log(data.selectedProject);
  //console.log($scope.selectedProject);


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
    };
    $uibModalInstance.close(deployment);
    //console.log(deployment);
  };
})

/**
 * Controller for the verify deployment modal dialog.
 */
  .controller('VerifyDeploymentCtrl', function($scope, $http, $resource, $uibModalInstance, Notification, deployments, deviceManagerUrl) {

  $scope.deployments = deployments;
  //console.log(deployments);

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
    var dm = devicelib(deviceManagerUrl);
    return dm.devices(deployment.devicequery, deployment.appquery).then(function(devices) {
      deployment.devices = devices;
      // Promise.all succeeds iff all the promises succeed.
      // TODO: what to do on (partially) unsuccessful deployment??!?!?!
      return Promise.all(devices.map(function(d) {
        return deployDevicePromise(d, deployment.project);
      }));
    });
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

