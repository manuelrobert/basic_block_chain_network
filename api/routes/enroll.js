const express = require('express');
const router = express.Router();

var user = require('../controller/user-controller');

router.post('/', user.enrollUser);

module.exports = router;