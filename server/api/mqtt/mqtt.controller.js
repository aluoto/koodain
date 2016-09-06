/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Antti Luoto <antti.l.luoto@tut.fi>
 */

/**
 * API for converting REST calls to MQTT messages.
 *
 */

'use strict';

var _ = require('lodash');
//var Project = require('./mqtt.model');
//var addProjectFiles = require('./projectfile.controller').addProjectFiles;
var errorHandler = require('../common').errorHandler;

var mqtt = require('mqtt');


// Create a new project.
exports.convert = function(req, res) {

  var client  = mqtt.connect('mqtt://130.230.16.45:1883');
  client.on('connect', function () {

      //publish empty apps list
      console.log("publish to: " + 'device/' + req.params.device + '/apps/' + req.params.app);
      client.publish('device/' + req.params.device + '/apps/' + req.params.app + '/status', JSON.stringify(req.body), {retain: true});

      //update certain app
      //client.subscribe('device/' + deviceInfo.idFromDM + '/app/' + aid + '/update');

  });

  console.log(req.body);
  return res.status(201);
  /*
  var data = req.body;
  if (!data.name || !data.name.match(/^[a-z][a-z0-9]*$/)) {
    return res.status(400).json({error: 'project name must match [a-z][a-z0-9]*'});
  }
  createProject(data).then(function(project) {
    return res.status(201).json(project);
  }).then(null, errorHandler(res));
*/
};

function createProject(data) {
  var project;
  return Project.create(data).then(function(_project) {
    project = _project;
    return initProjectFiles(project);
  }).then(function() {
    return project;
  });
}
exports.createProject = createProject;

function initProjectFiles(project) {
  // The examplepackage dir contains a template project.
  // The files
  var files = [
    './examplepackage/agent.js',
    './examplepackage/main.js',
    './examplepackage/package.json',
    './examplepackage/liquidiot.json',
  ];
  var vars = {
    project: project,
  };
  return addProjectFiles(files, project, vars);
}
