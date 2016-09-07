/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Antti Luoto <antti.l.luoto@tut.fi>
 */

'use strict';

var express = require('express');
var controller = require('./mqtt.controller');
var router = express.Router();

router.put('/:device/app/:app', controller.convert);

module.exports = router;