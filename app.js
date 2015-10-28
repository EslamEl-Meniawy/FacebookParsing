var fs = require("fs"),
	express = require("express"),
	bodyParser = require('body-parser'),
	http = require('http'),
	https = require('https'),
	cheerio = require('cheerio'),
	mysql = require('mysql'),
	path = require("path"),
	session = require('express-session'),
	cookieParser = require('cookie-parser');
var configuration = JSON.parse(fs.readFileSync("configuration.json"));
var connection = mysql.createConnection({
	host: configuration.dbHost,
	user: configuration.dbUser,
	password: configuration.dbUserPassword,
	database: configuration.dbName
});
var app = express();
var server = http.createServer(app);
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());
app.use(session({secret: 'session secret', saveUninitialized: true, resave: true}));
app.use(require('express-method-override')());
connection.connect(function(err) {
	if (err) {
		console.error('Database error connecting: ' + err.stack);
		return;
	}
	console.log('Database connected as id ' + connection.threadId);
});
connection.query('CREATE TABLE IF NOT EXISTS pages(id int PRIMARY KEY AUTO_INCREMENT, page_id varchar(50) UNIQUE, page_username varchar(50) UNIQUE, page_name varchar(255), search_date timestamp)', function(err, result) {
	if (err) {
		console.log(err);
	}
});
connection.query('CREATE TABLE IF NOT EXISTS groups(id int PRIMARY KEY AUTO_INCREMENT, group_id varchar(50) UNIQUE, group_name varchar(255), search_date timestamp)', function(err, result) {
	if (err) {
		console.log(err);
	}
});
fs.writeFileSync("data.json", JSON.stringify({}));
app.get("/", function(req, res) {
	req.session.pagepostslimit = 0;
	req.session.pagepostscount = 0;
	req.session.grouppostslimit = 0;
	req.session.grouppostscount = 0;
	req.session.userscount = 0;
	req.session.exportidslimit = 0;
	req.session.exportfbmailslimit = 0;
	req.session.memberscount = 0;
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	jsondata[req.sessionID + 'stoppagepostssearch'] = false;
	jsondata[req.sessionID + 'stopgrouppostssearch'] = false;
	jsondata[req.sessionID + 'stopuserssearch'] = false;
	fs.writeFileSync("data.json", JSON.stringify(jsondata));
	res.sendFile(path.join(__dirname+'/html/index.html'));
});
app.get("/pageposts/:pageUsername/:postsLim?", function(req, res) {
	var script = '';
	if (req.params.postsLim) {
		req.session.pagepostslimit = parseInt(req.params.postsLim);
	} else {
		req.session.pagepostslimit = 0;
		script = '<script type="text/javascript">document.getElementById("posts-count").innerHTML = "<div id=\\"posts-count-count\\" style=\\"margin-bottom: 5px;\\"></div><div class=\\"progress progress-striped active\\"><div class=\\"progress-bar progress-bar-primary\\" style=\\"width: 100%\\" aria-valuemax=\\"100\\" aria-valuemin=\\"0\\" aria-valuenow=\\"100\\" role=\\"progressbar\\"><span class=\\"sr-only\\">Getting posts...</span></div></div>";</script>';
	}
	req.session.pagepostscount = 0;
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	jsondata[req.sessionID + 'stoppagepostssearch'] = false;
	fs.writeFileSync("data.json", JSON.stringify(jsondata));
	res.setHeader("Content-Type", "text/html");
	var content = fs.readFileSync("./html/posts.html");
	content = content.toString("utf8");
	content = content.replace(/{{title}}/g, "Page");
	content = content.replace(/{{pageorgroup}}/g, "page");
	res.write(content);
	var pageDetailsOptions = {
		hostname: 'graph.facebook.com',
		port: 443,
		path: '/' + req.params.pageUsername + '?fields=id,name&access_token=777012902368097|RpAQLbUnens5FsiL-NA69odTQGY',
		method: 'GET'
	};
	var pageDetailsReq = https.request(pageDetailsOptions, function(pageDetailsRes) {
		res.write('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "Getting page details...";</script>');
		var returned = '';
		pageDetailsRes.on('data', function(chunk) {
			returned += chunk.toString("utf8");
		});
		pageDetailsRes.on('end', function () {
			res.write('<script type="text/javascript">document.getElementById("save-page-details").innerHTML = "Saving page details...";</script>');
			connection.query('SELECT 1 FROM pages WHERE page_id=' + connection.escape(JSON.parse(returned).id), function(err, results) {
				if (err) {
					console.log(err);
					res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				} else {
					if (results.length > 0) {
						var sql = 'UPDATE pages SET search_date=FROM_UNIXTIME(' + ((new Date().valueOf())/1000) + ') WHERE page_id=' + connection.escape(JSON.parse(returned).id);
						connection.query(sql, function(err, result) {
							if (err) {
								console.log(err);
								res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
							} else {
								res.write('<script type="text/javascript">document.getElementById("get-page-posts").innerHTML = "Getting page posts...";</script>');
								res.write(script);
								res.write('<script type="text/javascript">document.getElementById("stop").innerHTML = "<button class=\\"btn btn-danger btn-flat\\" onclick=\\"window.location = \'/stop/pageposts/' + JSON.parse(returned).id + '\'\\">Stop getting page posts</button>";</script>');
								getPagePosts(JSON.parse(returned).id, req, res, '');
							}
						});
					} else {
						var sql = 'INSERT IGNORE INTO pages (page_id,page_username,page_name,search_date) VALUES (' + connection.escape(JSON.parse(returned).id) + ',' + connection.escape(req.params.pageUsername) +',' + connection.escape(JSON.parse(returned).name) +',FROM_UNIXTIME(' + ((new Date().valueOf())/1000) +'))';
						connection.query(sql, function(err, result) {
							if (err) {
								console.log(err);
								res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
							} else {
								res.write('<script type="text/javascript">document.getElementById("get-page-posts").innerHTML = "Getting page posts...";</script>');
								res.write(script);
								res.write('<script type="text/javascript">document.getElementById("stop").innerHTML = "<button class=\\"btn btn-danger btn-flat\\" onclick=\\"window.location = \'/stop/pageposts/' + JSON.parse(returned).id + '\'\\">Stop getting page posts</button>";</script>');
								getPagePosts(JSON.parse(returned).id, req, res, '');
							}
						});
					}
				}
			});
		});
	});
	pageDetailsReq.end();
	pageDetailsReq.on('error', function(e) {
		console.log(e);
		res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Page Details Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
	});
});
app.get("/stop/pageposts/:pageID", function(req, res) {
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	jsondata[req.sessionID + 'stoppagepostssearch'] = true;
	fs.writeFileSync("data.json", JSON.stringify(jsondata));
	var content = fs.readFileSync("./html/stopPosts.html");
	content = content.toString("utf8");
	content = content.replace(/{{title}}/g, "Page");
	content = content.replace(/{{pageorgroup}}/g, "page");
	content = content.replace(/{{id}}/g, req.params.pageID);
	res.send(content);
});
app.get("/groupposts/:groupID/:postsLim?", function(req, res) {
	var script = '';
	if (req.params.postsLim) {
		req.session.grouppostslimit = parseInt(req.params.postsLim);
	} else {
		req.session.grouppostslimit = 0;
		script = '<script type="text/javascript">document.getElementById("posts-count").innerHTML = "<div id=\\"posts-count-count\\" style=\\"margin-bottom: 5px;\\"></div><div class=\\"progress progress-striped active\\"><div class=\\"progress-bar progress-bar-primary\\" style=\\"width: 100%\\" aria-valuemax=\\"100\\" aria-valuemin=\\"0\\" aria-valuenow=\\"100\\" role=\\"progressbar\\"><span class=\\"sr-only\\">Getting posts...</span></div></div>";</script>';
	}
	req.session.grouppostscount = 0;
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	jsondata[req.sessionID + 'stopgrouppostssearch'] = false;
	fs.writeFileSync("data.json", JSON.stringify(jsondata));
	res.setHeader("Content-Type", "text/html");
	var content = fs.readFileSync("./html/posts.html");
	content = content.toString("utf8");
	content = content.replace(/{{title}}/g, "Group");
	content = content.replace(/{{pageorgroup}}/g, "group");
	res.write(content);
	var groupDetailsOptions = {
		hostname: 'graph.facebook.com',
		port: 443,
		path: '/' + req.params.groupID + '?fields=name&access_token=777012902368097|RpAQLbUnens5FsiL-NA69odTQGY',
		method: 'GET'
	};
	var groupDetailsReq = https.request(groupDetailsOptions, function(groupDetailsRes) {
		res.write('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "Getting group details...";</script>');
		var returned = '';
		groupDetailsRes.on('data', function(chunk) {
			returned += chunk.toString("utf8");
		});
		groupDetailsRes.on('end', function () {
			res.write('<script type="text/javascript">document.getElementById("save-group-details").innerHTML = "Saving group details...";</script>');
			connection.query('SELECT 1 FROM groups WHERE group_id=' + connection.escape(req.params.groupID), function(err, results) {
				if (err) {
					console.log(err);
					res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				} else {
					if (results.length > 0) {
						var sql = 'UPDATE groups SET search_date=FROM_UNIXTIME(' + ((new Date().valueOf())/1000) + ') WHERE group_id=' + connection.escape(req.params.groupID);
						connection.query(sql, function(err, result) {
							if (err) {
								console.log(err);
								res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
							} else {
								res.write('<script type="text/javascript">document.getElementById("get-group-posts").innerHTML = "Getting group posts...";</script>');
								res.write(script);
								res.write('<script type="text/javascript">document.getElementById("stop").innerHTML = "<button class=\\"btn btn-danger btn-flat\\" onclick=\\"window.location = \'/stop/groupposts/' + JSON.parse(returned).id + '\'\\">Stop getting group posts</button>";</script>');
								getGroupPosts(req.params.groupID, req, res, '');
							}
						});
					} else {
						var sql = 'INSERT IGNORE INTO groups (group_id,group_name,search_date) VALUES (' + connection.escape(req.params.groupID) +',' + connection.escape(JSON.parse(returned).name) +',FROM_UNIXTIME(' + ((new Date().valueOf())/1000) +'))';
						connection.query(sql, function(err, result) {
							if (err) {
								console.log(err);
								res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
							} else {
								res.write('<script type="text/javascript">document.getElementById("get-group-posts").innerHTML = "Getting group posts...";</script>');
								res.write(script);
								res.write('<script type="text/javascript">document.getElementById("stop").innerHTML = "<button class=\\"btn btn-danger btn-flat\\" onclick=\\"window.location = \'/stop/groupposts/' + JSON.parse(returned).id + '\'\\">Stop getting group posts</button>";</script>');
								getGroupPosts(req.params.groupID, req, res, '');
							}
						});
					}
				}
			});
		});
	});
	groupDetailsReq.end();
	groupDetailsReq.on('error', function(e) {
		console.log(e);
		res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Group Details Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
	});
});
app.get("/stop/groupposts/:groupID", function(req, res) {
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	jsondata[req.sessionID + 'stopgrouppostssearch'] = true;
	fs.writeFileSync("data.json", JSON.stringify(jsondata));
	var content = fs.readFileSync("./html/stopPosts.html");
	content = content.toString("utf8");
	content = content.replace(/{{title}}/g, "Group");
	content = content.replace(/{{pageorgroup}}/g, "group");
	content = content.replace(/{{id}}/g, req.params.groupID);
	res.send(content);
});
app.get("/users/username/:pageUsername", function(req, res) {
	req.session.userscount = 0;
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	jsondata[req.sessionID + 'stopuserssearch'] = false;
	fs.writeFileSync("data.json", JSON.stringify(jsondata));
	res.setHeader("Content-Type", "text/html");
	var content = fs.readFileSync("./html/users.html");
	content = content.toString("utf8");
	res.write(content);
	connection.query('SELECT page_id FROM pages WHERE page_username=' + connection.escape(req.params.pageUsername), function(err, result) {
		if (err) {
			console.log(err);
			res.end('<script type="text/javascript">document.getElementById("get-users-data").innerHTML = "";document.getElementById("users-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
		} else {
			if (result.length > 0) {
				usersData(result[0].page_id, req, res);
			} else {
				res.end('<script type="text/javascript">document.getElementById("get-users-data").innerHTML = "";document.getElementById("users-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "No page found with that username!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
			}
		}
	});
});
app.get("/users/id/:ID", function(req, res) {
	req.session.userscount = 0;
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	jsondata[req.sessionID + 'stopuserssearch'] = false;
	fs.writeFileSync("data.json", JSON.stringify(jsondata));
	res.setHeader("Content-Type", "text/html");
	var content = fs.readFileSync("./html/users.html");
	content = content.toString("utf8");
	res.write(content);
	usersData(req.params.ID, req, res);
});
app.get("/users/stop/:ID", function(req, res) {
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	jsondata[req.sessionID + 'stopuserssearch'] = true;
	fs.writeFileSync("data.json", JSON.stringify(jsondata));
	var content = fs.readFileSync("./html/stopUsers.html");
	content = content.toString("utf8");
	content = content.replace(/{{id}}/g, req.params.ID);
	res.send(content);
});
app.get("/exportids/username/:pageUsername/:exportIdsLim?", function(req, res) {
	if (req.params.exportIdsLim) {
		req.session.exportidslimit = parseInt(req.params.exportIdsLim);
	} else {
		req.session.exportidslimit = 0;
	}
	connection.query('SELECT page_id FROM pages WHERE page_username=' + connection.escape(req.params.pageUsername), function(err, result) {
		if (err) {
			console.log(err);
			res.end("Database Error!");
		} else {
			if (result.length > 0) {
				exportIDs(result[0].page_id, req, res);
			} else {
				res.end("No page found with that username!");
			}
		}
	});
});
app.get("/exportids/id/:ID/:exportIdsLim?", function(req, res) {
	if (req.params.exportIdsLim) {
		req.session.exportidslimit = parseInt(req.params.exportIdsLim);
	} else {
		req.session.exportidslimit = 0;
	}
	exportIDs(req.params.ID, req, res);
});
app.get("/exportfbmails/username/:pageUsername/:exportfbMailsLim?", function(req, res) {
	if (req.params.exportfbMailsLim) {
		req.session.exportfbmailslimit = parseInt(req.params.exportfbMailsLim);
	} else {
		req.session.exportfbmailslimit = 0;
	}
	connection.query('SELECT page_id FROM pages WHERE page_username=' + connection.escape(req.params.pageUsername), function(err, result) {
		if (err) {
			console.log(err);
			res.end("Database Error!");
		} else {
			if (result.length > 0) {
				exportFBMails(result[0].page_id, req, res);
			} else {
				res.end("No page found with that username!");
			}
		}
	});
});
app.get("/exportfbmails/id/:ID/:exportfbMailsLim?", function(req, res) {
	if (req.params.exportfbMailsLim) {
		req.session.exportfbmailslimit = parseInt(req.params.exportfbMailsLim);
	} else {
		req.session.exportfbmailslimit = 0;
	}
	exportFBMails(req.params.ID, req, res);
});
app.get("/groupusers/:ID/:error?", function(req, res) {
	res.setHeader("Content-Type", "text/html");
	var content = fs.readFileSync("./html/groupMembers.html");
	content = content.toString("utf8");
	content = content.replace(/{{id}}/g, req.params.ID);
	if (req.params.error) {
		content = content.replace(/{{error}}/g, 'class="has-error"');
	} else {
		content = content.replace(/{{error}}/g, "");
	}
	res.end(content);
});
app.post("/groupuserspost/:ID", function(req, res) {
	var htmldata = req.body.htmldata;
	if (htmldata == null || htmldata == '' || !htmldata) {
		res.redirect('/groupusers/' + req.params.ID + '/error');
	} else {
		req.session.memberscount = 0;
		res.setHeader("Content-Type", "text/html");
		var content = fs.readFileSync("./html/getGroupMembers.html");
		content = content.toString("utf8");
		res.write(content);
		var $ = cheerio.load(htmldata);
		var urls = [];
		$('a._8o._ohe').each(function(i, elem) {
			urls[i] = $(this).attr('href');
		});
		res.write('<script type="text/javascript">document.getElementById("get-members-data").innerHTML = "Getting group members public data...";</script>');
		res.write('<script type="text/javascript">document.getElementById("members-count").innerHTML = "<div id=\\"members-count-count\\" style=\\"margin-bottom: 5px;\\"></div><div class=\\"progress progress-striped active\\"><div class=\\"progress-bar progress-bar-primary\\" style=\\"width: 100%\\" aria-valuemax=\\"100\\" aria-valuemin=\\"0\\" aria-valuenow=\\"100\\" role=\\"progressbar\\"><span class=\\"sr-only\\">Getting members data...</span></div></div>";</script>');
		getGroupUsersPublicData(0, urls, req.params.ID, req, res);
	}
});
app.get("/history/pages", function(req, res) {
	var content = fs.readFileSync("./html/history.html");
	content = content.toString("utf8");
	connection.query('SELECT page_id, page_username, page_name, search_date FROM pages ORDER BY search_date DESC', function(err, results) {
		if (err) {
			console.log(err);
			var errorContent = fs.readFileSync("./html/historyError.html");
			errorContent = errorContent.toString("utf8");
			errorContent = errorContent.replace(/{{title}}/g, 'Page');
			errorContent = errorContent.replace(/{{error}}/g, 'Database Error!');
			res.send(errorContent);
		} else {
			if (results.length > 0) {
				var pagesCount = results.length;
				var pagingCount = Math.ceil(pagesCount / 6);
				var trinfo = fs.readFileSync("./html/trinfo.html");
				trinfo = trinfo.toString("utf8");
				var trprimary = fs.readFileSync("./html/trprimary.html");
				trprimary = trprimary.toString("utf8");
				if (pagesCount <= 6) {
					var table = '<table class="table"><tbody>';
					for (var i = 0; i < pagesCount; i++) {
						var index = i;
						if (((index + 1) % 2) > 0) {
							table += trinfo.replace(/{{name}}/g, results[index].page_name).replace(/{{usernameorid}}/g, results[index].page_username).replace(/{{id}}/g, results[index].page_id);
						} else {
							table += trprimary.replace(/{{name}}/g, results[index].page_name).replace(/{{usernameorid}}/g, results[index].page_username).replace(/{{id}}/g, results[index].page_id);
						}
					}
					table += '</tbody></table>';
					content = content.replace(/{{table}}/g, table);
				} else {
					var table = '<table class="table"><tbody>';
					for (var i = 0; i < 6; i++) {
						var index = i;
						if (((index + 1) % 2) > 0) {
							table += trinfo.replace(/{{name}}/g, results[index].page_name).replace(/{{usernameorid}}/g, results[index].page_username).replace(/{{id}}/g, results[index].page_id);
						} else {
							table += trprimary.replace(/{{name}}/g, results[index].page_name).replace(/{{usernameorid}}/g, results[index].page_username).replace(/{{id}}/g, results[index].page_id);
						}
					}
					table += '</tbody></table>';
					content = content.replace(/{{table}}/g, table);
				}
				content = content.replace(/{{title}}/g, 'Page');
				content = content.replace(/{{array}}/g, JSON.stringify(results));
				content = content.replace(/{{total}}/g, parseInt(pagingCount));
				res.send(content);
			} else {
				var errorContent = fs.readFileSync("./html/historyError.html");
				errorContent = errorContent.toString("utf8");
				errorContent = errorContent.replace(/{{title}}/g, 'Page');
				errorContent = errorContent.replace(/{{error}}/g, 'No pages history was found!');
				res.send(errorContent);
			}
		}
	});
});
app.get("/history/groups", function(req, res) {
	var content = fs.readFileSync("./html/history.html");
	content = content.toString("utf8");
	connection.query('SELECT group_id, group_name, search_date FROM groups ORDER BY search_date DESC', function(err, results) {
		if (err) {
			console.log(err);
			var errorContent = fs.readFileSync("./html/historyError.html");
			errorContent = errorContent.toString("utf8");
			errorContent = errorContent.replace(/{{title}}/g, 'Group');
			errorContent = errorContent.replace(/{{error}}/g, 'Database Error!');
			res.send(errorContent);
		} else {
			if (results.length > 0) {
				var groupsCount = results.length;
				var pagingCount = Math.ceil(groupsCount / 6);
				var trinfo = fs.readFileSync("./html/trinfo.html");
				trinfo = trinfo.toString("utf8");
				var trprimary = fs.readFileSync("./html/trprimary.html");
				trprimary = trprimary.toString("utf8");
				if (groupsCount <= 6) {
					var table = '<table class="table"><tbody>';
					for (var i = 0; i < groupsCount; i++) {
						var index = i;
						if (((index + 1) % 2) > 0) {
							table += trinfo.replace(/{{name}}/g, results[index].group_name).replace(/{{usernameorid}}/g, results[index].group_id).replace(/{{id}}/g, results[index].group_id);
						} else {
							table += trprimary.replace(/{{name}}/g, results[index].group_name).replace(/{{usernameorid}}/g, results[index].group_id).replace(/{{id}}/g, results[index].group_id);
						}
					}
					table += '</tbody></table>';
					content = content.replace(/{{table}}/g, table);
				} else {
					var table = '<table class="table"><tbody>';
					for (var i = 0; i < 6; i++) {
						var index = i;
						if (((index + 1) % 2) > 0) {
							table += trinfo.replace(/{{name}}/g, results[index].group_name).replace(/{{usernameorid}}/g, results[index].group_id).replace(/{{id}}/g, results[index].group_id);
						} else {
							table += trprimary.replace(/{{name}}/g, results[index].group_name).replace(/{{usernameorid}}/g, results[index].group_id).replace(/{{id}}/g, results[index].group_id);
						}
					}
					table += '</tbody></table>';
					content = content.replace(/{{table}}/g, table);
				}
				content = content.replace(/{{title}}/g, 'Group');
				content = content.replace(/{{array}}/g, JSON.stringify(results));
				content = content.replace(/{{total}}/g, parseInt(pagingCount));
				res.send(content);
			} else {
				var errorContent = fs.readFileSync("./html/historyError.html");
				errorContent = errorContent.toString("utf8");
				errorContent = errorContent.replace(/{{title}}/g, 'Group');
				errorContent = errorContent.replace(/{{error}}/g, 'No groups history was found!');
				res.send(errorContent);
			}
		}
	});
});
app.get("/exportmultiids/:IDs", function(req, res) {
	var IDs = JSON.parse(req.params.IDs);
	var name = req.params.IDs.toString('utf8');
	name = name.replace('[', '').replace(']', '').replace(/"/g, '').replace(/,/g, '_');
	name = 'users' + name;
	var sql = '';
	for (var i = 0; i < IDs.length; i++) {
		if ((i + 1) == IDs.length) {
			var query = 'SELECT user_id FROM users' + IDs[i];
			sql += query;
		} else {
			var query = 'SELECT user_id FROM users' + IDs[i] + ' UNION ';
			sql += query;
		}
	}
	connection.query(sql, function(err, results) {
		if (err) {
			console.log(err);
			res.end("Database Error!");
		} else {
			var streamOptions = { encoding: 'utf8' };
			var wstream = fs.createWriteStream('/tmp/' + name + 'ids.txt', streamOptions);
			for (var i = 0; i < results.length; i++) {
				if ((i + 1) == results.length) {
					wstream.write(results[i].user_id);
				} else {
					wstream.write(results[i].user_id + '\r\n');
				}
			}
			wstream.end(function() {
				res.setHeader('Content-Type', 'text/plain');
				res.setHeader("Content-Disposition", "attachment;filename=" + name + "ids.txt");
				var filestream = fs.createReadStream('/tmp/' + name + 'ids.txt');
				filestream.pipe(res);
				var had_error = false;
				filestream.on('error', function(err) {
					had_error = true;
				});
				filestream.on('close', function() {
					if (!had_error) fs.unlink('/tmp/' + name + 'ids.txt');
				});
			});
		}
	});
});
app.get("*", function(req, res) {
	res.status(404).send("<h1>Not found :(</h1>");
});
app.listen(configuration.port, configuration.host);
console.log("Server listenning on: " + configuration.host + ":" + configuration.port);
function getPagePosts(pageID, req, res, next) {
	if (next == null || next == '') {
		connection.query('CREATE TABLE IF NOT EXISTS pageposts(id int PRIMARY KEY AUTO_INCREMENT, post_id varchar(50) UNIQUE, post_created_time varchar(25), page_id varchar(50), FOREIGN KEY (page_id) REFERENCES pages(page_id))', function(err, result) {
			if (err) {
				console.log(err);
				res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
			} else {
				var getPagePostsOptions = {
					hostname: 'graph.facebook.com',
					port: 443,
					path: '/' + pageID + '/posts?fields=id,created_time&access_token=777012902368097|RpAQLbUnens5FsiL-NA69odTQGY',
					method: 'GET'
				};
				var getPagePostsReq = https.request(getPagePostsOptions, function(getPagePostsRes) {
					var returned = '';
					getPagePostsRes.on('data', function(chunk) {
						returned += chunk.toString("utf8");
					});
					getPagePostsRes.on('end', function () {
						if (JSON.parse(returned).data.length > 0) {
							savePost(0, JSON.parse(returned).data, pageID, JSON.parse(returned).paging.next, req, res, 'page', function(pageid, request, response, nextURL) {
								getPagePosts(pageid, request, response, nextURL);
							});
						} else {
							res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "No Posts!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						}
					});
				});
				getPagePostsReq.end();
				getPagePostsReq.on('error', function(e) {
					console.log(e);
					res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Page Posts Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				});
			}
		});
	} else {
		var getNextPagePostsOptions = {
			hostname: 'graph.facebook.com',
			port: 443,
			path: next.slice(26),
			method: 'GET'
		};
		var getNextPagePostsReq = https.request(getNextPagePostsOptions, function(getNextPagePostsRes) {
			var returned = '';
			getNextPagePostsRes.on('data', function(chunk) {
				returned += chunk.toString("utf8");
			});
			getNextPagePostsRes.on('end', function () {
				if (JSON.parse(returned).data.length > 0) {
					savePost(0, JSON.parse(returned).data, pageID, JSON.parse(returned).paging.next, req, res, 'page', function(pageid, request, response, nextURL) {
						getPagePosts(pageid, request, response, nextURL);
					});
				} else {
					res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all available posts";document.getElementById("get-user-data").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/users/id/' + pageID + '\'\\">Get users public data</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				}
			});
		});
		getNextPagePostsReq.end();
		getNextPagePostsReq.on('error', function(e) {
			console.log(e);
			res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Page Posts Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
		});
	}
}
function getGroupPosts(groupID, req, res, next) {
	if (next == null || next == '') {
		connection.query('CREATE TABLE IF NOT EXISTS groupposts(id int PRIMARY KEY AUTO_INCREMENT, post_id varchar(50) UNIQUE, post_created_time varchar(25), group_id varchar(50), FOREIGN KEY (group_id) REFERENCES groups(group_id))', function(err, result) {
			if (err) {
				console.log(err);
				res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
			} else {
				var getGroupPostsOptions = {
					hostname: 'graph.facebook.com',
					port: 443,
					path: '/' + groupID + '/feed?fields=id,created_time&access_token=777012902368097|RpAQLbUnens5FsiL-NA69odTQGY',
					method: 'GET'
				};
				var getGroupPostsReq = https.request(getGroupPostsOptions, function(getGroupPostsRes) {
					var returned = '';
					getGroupPostsRes.on('data', function(chunk) {
						returned += chunk.toString("utf8");
					});
					getGroupPostsRes.on('end', function () {
						if (JSON.parse(returned).data.length > 0) {
							savePost(0, JSON.parse(returned).data, groupID, JSON.parse(returned).paging.next, req, res, 'group', function(groupid, request, response, nextURL) {
								getGroupPosts(groupid, request, response, nextURL);
							});
						} else {
							res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "No Posts!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						}
					});
				});
				getGroupPostsReq.end();
				getGroupPostsReq.on('error', function(e) {
					console.log(e);
					res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Group Posts Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				});
			}
		});
	} else {
		var getNextGroupPostsOptions = {
			hostname: 'graph.facebook.com',
			port: 443,
			path: next.slice(26),
			method: 'GET'
		};
		var getNextGroupPostsReq = https.request(getNextGroupPostsOptions, function(getNextGroupPostsRes) {
			var returned = '';
			getNextGroupPostsRes.on('data', function(chunk) {
				returned += chunk.toString("utf8");
			});
			getNextGroupPostsRes.on('end', function () {
				if (JSON.parse(returned).data.length > 0) {
					savePost(0, JSON.parse(returned).data, groupID, JSON.parse(returned).paging.next, req, res, 'group', function(groupid, request, response, nextURL) {
						getGroupPosts(groupid, request, response, nextURL);
					});
				} else {
					res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all available posts";document.getElementById("get-user-data").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/users/id/' + groupID + '\'\\">Get users public data</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				}
			});
		});
		getNextGroupPostsReq.end();
		getNextGroupPostsReq.on('error', function(e) {
			console.log(e);
			res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Group Posts Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
		});
	}
}
function savePost(index, data, ID, next, req, res, from, callback) {
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	var stopPostsSearch = null;
	if (from == 'page') {
		stopPostsSearch = jsondata[req.sessionID + 'stoppagepostssearch'];
	} else {
		stopPostsSearch = jsondata[req.sessionID + 'stopgrouppostssearch'];
	}
	if (!stopPostsSearch && stopPostsSearch != null) {
		if (from == 'page') {
			if (parseInt(req.session.pagepostslimit) == 0) {
				if (index < data.length) {
					req.session.pagepostscount = parseInt(req.session.pagepostscount) + 1;
					res.write('<script type="text/javascript">document.getElementById("posts-count-count").innerHTML = "Getting post: ' + req.session.pagepostscount + '";</script>');
					var postId = data[index].id;
					var sql = 'SELECT 1 FROM pageposts WHERE post_id=' + connection.escape(postId);
					connection.query(sql, function(err, results) {
						if (err) {
							console.log(err);
							res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						} else {
							if (results.length > 0) {
								getPostComments(index, data, ID, next, req, res, '', callback, from);
							} else {
								var post = {post_id: data[index].id, post_created_time: data[index].created_time, page_id: ID};
								var sql = 'INSERT IGNORE INTO pageposts SET ?';
								connection.query(sql, post, function(err, result) {
									if (err) {
										console.log(err);
										res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
									} else {
										getPostComments(index, data, ID, next, req, res, '', callback, from);
									}
								});
							}
						}
					});
				} else {
					if (!next || next == null || next == '') {
						res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all available posts";document.getElementById("get-user-data").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/users/id/' + ID + '\'\\">Get users public data</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
					} else {
						callback(ID, req, res, next);
					}
				}
			} else {
				if (parseInt(req.session.pagepostscount) < parseInt(req.session.pagepostslimit)) {
					if (index < data.length) {
						req.session.pagepostscount = parseInt(req.session.pagepostscount) + 1;
						res.write('<script type="text/javascript">document.getElementById("posts-count").innerHTML = "<div id=\\"posts-count-count\\" style=\\"margin-bottom: 5px;\\">Getting post ' + req.session.pagepostscount + ' of ' + req.session.pagepostslimit +'</div><div class=\\"progress progress-striped active\\"><div class=\\"progress-bar progress-bar-primary\\" style=\\"width: ' + ((req.session.pagepostscount / req.session.pagepostslimit) * 100) + '%\\" aria-valuemax=\\"100\\" aria-valuemin=\\"0\\" aria-valuenow=\\"' + ((req.session.pagepostscount / req.session.pagepostslimit) * 100) + '\\" role=\\"progressbar\\"><span class=\\"sr-only\\">Getting posts...</span></div></div>";</script>');
						var postId = data[index].id;
						var sql = 'SELECT 1 FROM pageposts WHERE post_id=' + connection.escape(postId);
						connection.query(sql, function(err, results) {
							if (err) {
								console.log(err);
								res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
							} else {
								if (results.length > 0) {
									getPostComments(index, data, ID, next, req, res, '', callback, from);
								} else {
									var post = {post_id: data[index].id, post_created_time: data[index].created_time, page_id: ID};
									var sql = 'INSERT IGNORE INTO pageposts SET ?';
									connection.query(sql, post, function(err, result) {
										if (err) {
											console.log(err);
											res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
										} else {
											getPostComments(index, data, ID, next, req, res, '', callback, from);
										}
									});
								}
							}
						});
					} else {
						if (!next || next == null || next == '') {
							res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all desired posts";document.getElementById("get-user-data").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/users/id/' + ID + '\'\\">Get users public data</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						} else {
							callback(ID, req, res, next);
						}
					}
				} else {
					res.end('<script type="text/javascript">document.getElementById("get-page-details").innerHTML = "";document.getElementById("save-page-details").innerHTML = "";document.getElementById("get-page-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all desired posts";document.getElementById("get-user-data").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/users/id/' + ID + '\'\\">Get users public data</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				}
			}
		} else {
			if (parseInt(req.session.grouppostslimit) == 0) {
				if (index < data.length) {
					req.session.grouppostscount = parseInt(req.session.grouppostscount) + 1;
					res.write('<script type="text/javascript">document.getElementById("posts-count-count").innerHTML = "Getting post: ' + req.session.grouppostscount + '";</script>');
					var postId = data[index].id;
					var sql = 'SELECT 1 FROM groupposts WHERE post_id=' + connection.escape(postId);
					connection.query(sql, function(err, results) {
						if (err) {
							console.log(err);
							res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						} else {
							if (results.length > 0) {
								getPostComments(index, data, ID, next, req, res, '', callback, from);
							} else {
								var post = {post_id: data[index].id, post_created_time: data[index].created_time, group_id: ID};
								var sql = 'INSERT IGNORE INTO groupposts SET ?';
								connection.query(sql, post, function(err, result) {
									if (err) {
										console.log(err);
										res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
									} else {
										getPostComments(index, data, ID, next, req, res, '', callback, from);
									}
								});
							}
						}
					});
				} else {
					if (!next || next == null || next == '') {
						res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all available posts";document.getElementById("get-user-data").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/users/id/' + ID + '\'\\">Get users public data</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
					} else {
						callback(ID, req, res, next);
					}
				}
			} else {
				if (parseInt(req.session.grouppostscount) < parseInt(req.session.grouppostslimit)) {
					if (index < data.length) {
						req.session.grouppostscount = parseInt(req.session.grouppostscount) + 1;
						res.write('<script type="text/javascript">document.getElementById("posts-count").innerHTML = "<div id=\\"posts-count-count\\" style=\\"margin-bottom: 5px;\\">Getting post ' + req.session.grouppostscount + ' of ' + req.session.grouppostslimit +'</div><div class=\\"progress progress-striped active\\"><div class=\\"progress-bar progress-bar-primary\\" style=\\"width: ' + ((req.session.grouppostscount / req.session.grouppostslimit) * 100) + '%\\" aria-valuemax=\\"100\\" aria-valuemin=\\"0\\" aria-valuenow=\\"' + ((req.session.grouppostscount / req.session.grouppostslimit) * 100) + '\\" role=\\"progressbar\\"><span class=\\"sr-only\\">Getting posts...</span></div></div>";</script>');
						var postId = data[index].id;
						var sql = 'SELECT 1 FROM groupposts WHERE post_id=' + connection.escape(postId);
						connection.query(sql, function(err, results) {
							if (err) {
								console.log(err);
								res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
							} else {
								if (results.length > 0) {
									getPostComments(index, data, ID, next, req, res, '', callback, from);
								} else {
									var post = {post_id: data[index].id, post_created_time: data[index].created_time, group_id: ID};
									var sql = 'INSERT IGNORE INTO groupposts SET ?';
									connection.query(sql, post, function(err, result) {
										if (err) {
											console.log(err);
											res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
										} else {
											getPostComments(index, data, ID, next, req, res, '', callback, from);
										}
									});
								}
							}
						});
					} else {
						if (!next || next == null || next == '') {
							res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all desired posts";document.getElementById("get-user-data").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/users/id/' + ID + '\'\\">Get users public data</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						} else {
							callback(ID, req, res, next);
						}
					}
				} else {
					res.end('<script type="text/javascript">document.getElementById("get-group-details").innerHTML = "";document.getElementById("save-group-details").innerHTML = "";document.getElementById("get-group-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all desired posts";document.getElementById("get-user-data").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/users/id/' + ID + '\'\\">Get users public data</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				}
			}
		}
	}
}
function getPostComments(index, data, ID, next, req, res, commentNext, callback, from) {
	if (commentNext == null || commentNext == '') {
		var tableName = 'users' + ID;
		var sql = 'CREATE TABLE IF NOT EXISTS ' + tableName + '(id int PRIMARY KEY AUTO_INCREMENT, user_id varchar(50) UNIQUE, user_name varchar(255), user_first_name varchar(100), user_last_name varchar(100), user_username varchar(50) UNIQUE, user_gender varchar(10), user_locale varchar(5), user_fb_mail varchar(255) DEFAULT "", user_mail varchar(255), user_phone varchar(30), count int)';
		connection.query(sql, function(err, result) {
			if (err) {
				console.log(err);
				res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
			} else {
				var getPostCommentsOptions = {
					hostname: 'graph.facebook.com',
					port: 443,
					path: '/' + data[index].id + '/comments?fields=from&access_token=777012902368097|RpAQLbUnens5FsiL-NA69odTQGY',
					method: 'GET'
				};
				var getPostCommentsReq = https.request(getPostCommentsOptions, function(getPostCommentsRes) {
					var returned = '';
					getPostCommentsRes.on('data', function(chunk) {
						returned += chunk.toString("utf8");
					});
					getPostCommentsRes.on('end', function () {
						if (JSON.parse(returned).data.length > 0) {
							saveComment(index, data, ID, next, req, res, JSON.parse(returned).paging.next, callback, from, 0, JSON.parse(returned).data, function(postIndex, postData, id, nextURL, request, response, commentNextURL, postCallback, postFrom) {
								getPostComments(postIndex, postData, id, nextURL, request, response, commentNextURL, postCallback, postFrom);
							});
						} else {
							getPostLikes(index, data, ID, next, req, res, '', callback, from);
						}
					});
				});
				getPostCommentsReq.end();
				getPostCommentsReq.on('error', function(e) {
					console.log(e);
					res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Post Comments Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				});
			}
		});
	} else {
		var getNextPostCommentsOptions = {
			hostname: 'graph.facebook.com',
			port: 443,
			path: commentNext.slice(26),
			method: 'GET'
		};
		var getNextPostCommentsReq = https.request(getNextPostCommentsOptions, function(getNextPostCommentsRes) {
			var returned = '';
			getNextPostCommentsRes.on('data', function(chunk) {
				returned += chunk.toString("utf8");
			});
			getNextPostCommentsRes.on('end', function () {
				if (JSON.parse(returned).data.length > 0) {
					saveComment(index, data, ID, next, req, res, JSON.parse(returned).paging.next, callback, from, 0, JSON.parse(returned).data, function(postIndex, postData, id, nextURL, request, response, commentNextURL, postCallback, postFrom) {
						getPostComments(postIndex, postData, id, nextURL, request, response, commentNextURL, postCallback, postFrom);
					});
				} else {
					getPostLikes(index, data, ID, next, req, res, '', callback, from);
				}
			});
		});
		getNextPostCommentsReq.end();
		getNextPostCommentsReq.on('error', function(e) {
			console.log(e);
			res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Post Comments Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
		});
	}
}
function saveComment(index, data, ID, next, req, res, commentNext, callback, from, commentIndex, commentData, commentCallback) {
	if (commentIndex < commentData.length) {
		var tableName = 'users' + ID;
		var userId = commentData[commentIndex].from.id;
		var sql = 'SELECT count FROM ' + tableName + ' WHERE user_id=' + connection.escape(userId);
		connection.query(sql, function(err, results) {
			if (err) {
				console.log(err);
				res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
			} else {
				if (results.length > 0) {
					var sql = 'UPDATE ' + tableName + ' SET ? WHERE user_id=' + connection.escape(userId);
					var incrementedCount = parseInt(results[0].count) + 1;
					var user  = {count: incrementedCount};
					connection.query(sql, user, function(err, result) {
						if (err) {
							console.log(err);
							res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						} else {
							commentIndex += 1;
							saveComment(index, data, ID, next, req, res, commentNext, callback, from, commentIndex, commentData, commentCallback);
						}
					});
				} else {
					var user  = {user_id: userId, user_name: commentData[commentIndex].from.name, count: 1};
					connection.query('INSERT IGNORE INTO ' + tableName + ' SET ?', user, function(err, result) {
						if (err) {
							console.log(err);
							res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						} else {
							commentIndex += 1;
							saveComment(index, data, ID, next, req, res, commentNext, callback, from, commentIndex, commentData, commentCallback);
						}
					});
				}
			}
		});
	} else {
		if (!commentNext || commentNext == null || commentNext == '') {
			getPostLikes(index, data, ID, next, req, res, '', callback, from);
		} else {
			commentCallback(index, data, ID, next, req, res, commentNext, callback, from);
		}
	}
}
function getPostLikes(index, data, ID, next, req, res, likeNext, callback, from) {
	if (likeNext == null || likeNext == '') {
		var tableName = 'users' + ID;
		var sql = 'CREATE TABLE IF NOT EXISTS ' + tableName + '(id int PRIMARY KEY AUTO_INCREMENT, user_id varchar(50) UNIQUE, user_name varchar(255), user_first_name varchar(100), user_last_name varchar(100), user_username varchar(50) UNIQUE, user_gender varchar(10), user_locale varchar(5), user_fb_mail varchar(255) DEFAULT "", user_mail varchar(255), user_phone varchar(30), count int)';
		connection.query(sql, function(err, result) {
			if (err) {
				console.log(err);
				res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
			} else {
				var getPostLikesOptions = {
					hostname: 'graph.facebook.com',
					port: 443,
					path: '/' + data[index].id + '/likes?access_token=777012902368097|RpAQLbUnens5FsiL-NA69odTQGY',
					method: 'GET'
				};
				var getPostLikesReq = https.request(getPostLikesOptions, function(getPostLikesRes) {
					var returned = '';
					getPostLikesRes.on('data', function(chunk) {
						returned += chunk.toString("utf8");
					});
					getPostLikesRes.on('end', function () {
						if (JSON.parse(returned).data.length > 0) {
							saveLike(index, data, ID, next, req, res, JSON.parse(returned).paging.next, callback, from, 0, JSON.parse(returned).data, function(postIndex, postData, id, nextURL, request, response, likeNextURL, postCallback, postFrom) {
								getPostLikes(postIndex, postData, id, nextURL, request, response, likeNextURL, postCallback, postFrom);
							});
						} else {
							index += 1;
							savePost(index, data, ID, next, req, res, from, callback);
						}
					});
				});
				getPostLikesReq.end();
				getPostLikesReq.on('error', function(e) {
					console.log(e);
					res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Post Likes Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				});
			}
		});
	} else {
		var getNextPostLikesOptions = {
			hostname: 'graph.facebook.com',
			port: 443,
			path: likeNext.slice(26),
			method: 'GET'
		};
		var getNextPostLikesReq = https.request(getNextPostLikesOptions, function(getNextPostLikesRes) {
			var returned = '';
			getNextPostLikesRes.on('data', function(chunk) {
				returned += chunk.toString("utf8");
			});
			getNextPostLikesRes.on('end', function () {
				if (JSON.parse(returned).data.length > 0) {
					saveLike(index, data, ID, next, req, res, JSON.parse(returned).paging.next, callback, from, 0, JSON.parse(returned).data, function(postIndex, postData, id, nextURL, request, response, likeNextURL, postCallback, postFrom) {
						getPostLikes(postIndex, postData, id, nextURL, request, response, likeNextURL, postCallback, postFrom);
					});
				} else {
					index += 1;
					savePost(index, data, ID, next, req, res, from, callback);
				}
			});
		});
		getNextPostLikesReq.end();
		getNextPostLikesReq.on('error', function(e) {
			console.log(e);
			res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting Post Likes Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
		});
	}
}
function saveLike(index, data, ID, next, req, res, likeNext, callback, from, likeIndex, likeData, likeCallback) {
	if (likeIndex < likeData.length) {
		var tableName = 'users' + ID;
		var userId = likeData[likeIndex].id;
		var sql = 'SELECT count FROM ' + tableName + ' WHERE user_id=' + connection.escape(userId);
		connection.query(sql, function(err, results) {
			if (err) {
				console.log(err);
				res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
			} else {
				if (results.length > 0) {
					var sql = 'UPDATE ' + tableName + ' SET ? WHERE user_id=' + connection.escape(userId);
					var incrementedCount = parseInt(results[0].count) + 1;
					var user  = {count: incrementedCount};
					connection.query(sql, user, function(err, result) {
						if (err) {
							console.log(err);
							res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						} else {
							likeIndex += 1;
							saveLike(index, data, ID, next, req, res, likeNext, callback, from, likeIndex, likeData, likeCallback);
						}
					});
				} else {
					var user  = {user_id: userId, user_name: likeData[likeIndex].name, count: 1};
					connection.query('INSERT IGNORE INTO ' + tableName + ' SET ?', user, function(err, result) {
						if (err) {
							console.log(err);
							res.end('<script type="text/javascript">document.getElementById("get-' + from + '-details").innerHTML = "";document.getElementById("save-' + from + '-details").innerHTML = "";document.getElementById("get-' + from + '-posts").innerHTML = "";document.getElementById("posts-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("get-user-data").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						} else {
							likeIndex += 1;
							saveLike(index, data, ID, next, req, res, likeNext, callback, from, likeIndex, likeData, likeCallback);
						}
					});
				}
			}
		});
	} else {
		if (!likeNext || likeNext == null || likeNext == '') {
			index += 1;
			savePost(index, data, ID, next, req, res, from, callback);
		} else {
			likeCallback(index, data, ID, next, req, res, likeNext, callback, from);
		}
	}
}
function getUserPublicData(index, data, ID, req, res) {
	var jsondata = JSON.parse(fs.readFileSync("data.json"));
	jsondata[req.sessionID + 'stopuserssearch'];
	if (!jsondata[req.sessionID + 'stopuserssearch']) {
		if (index < data.length) {
			var tableName = 'users' + ID;
			var sql = 'SELECT user_locale from ' + tableName + ' WHERE user_id=' + connection.escape(data[index].user_id);
			connection.query(sql, function(err, results) {
				if (err) {
					console.log(err);
					res.end('<script type="text/javascript">document.getElementById("get-users-data").innerHTML = "";document.getElementById("users-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				} else {
					if (results[0].user_locale != null) {
						index += 1;
						getUserPublicData(index, data, ID, req, res);
					} else {
						var getUserPublicDataOptions = {
							hostname: 'graph.facebook.com',
							port: 443,
							path: '/' + data[index].user_id + '?access_token=777012902368097|RpAQLbUnens5FsiL-NA69odTQGY',
							method: 'GET'
						};
						var getUserPublicDataReq = https.request(getUserPublicDataOptions, function(getUserPublicDataRes) {
							req.session.userscount = parseInt(req.session.userscount) + 1;
							res.write('<script type="text/javascript">document.getElementById("users-count-count").innerHTML = "Getting user: ' + req.session.userscount + '";</script>');
							var returned = '';
							getUserPublicDataRes.on('data', function(chunk) {
								returned += chunk.toString("utf8");
							});
							getUserPublicDataRes.on('end', function () {
								var mail = '';
								if (!JSON.parse(returned).username || JSON.parse(returned).username == null || JSON.parse(returned).username == '') {
									mail = JSON.parse(returned).id + '@facebook.com';
								} else {
									mail = JSON.parse(returned).username + '@facebook.com';
								}
								var user  = {user_first_name: JSON.parse(returned).first_name, user_last_name: JSON.parse(returned).last_name, user_username: JSON.parse(returned).username, user_gender: JSON.parse(returned).gender, user_locale: JSON.parse(returned).locale, user_fb_mail: mail};
								var sql = 'UPDATE ' + tableName + ' SET ? WHERE user_id=' + connection.escape(data[index].user_id);
								connection.query(sql, user, function(err, result) {
									if (err) {
										console.log(err);
										res.end('<script type="text/javascript">document.getElementById("get-users-data").innerHTML = "";document.getElementById("users-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
									} else {
										index += 1;
										getUserPublicData(index, data, ID, req, res);
									}
								});
							});
						});
						getUserPublicDataReq.end();
						getUserPublicDataReq.on('error', function(e) {
							console.log(e);
							res.end('<script type="text/javascript">document.getElementById("get-users-data").innerHTML = "";document.getElementById("users-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Getting User Details Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
						});
					}
				}
			});
		} else {
			res.end('<script type="text/javascript">document.getElementById("get-users-data").innerHTML = "";document.getElementById("users-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all users public data";document.getElementById("export-ids").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/exportids/id/' + ID + '\'\\">Export users ids</button>";document.getElementById("export-fb-mails").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/exportfbmails/id/' + ID + '\'\\">Export users facebook mails</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
		}
	}
}
function getGroupUsersPublicData(index, data, ID, req, res) {
	if (index < data.length) {
		var tableName = 'users' + ID;
		if (index == 0) {
			var sql = 'CREATE TABLE IF NOT EXISTS ' + tableName + '(id int PRIMARY KEY AUTO_INCREMENT, user_id varchar(50) UNIQUE, user_name varchar(255), user_first_name varchar(100), user_last_name varchar(100), user_username varchar(50) UNIQUE, user_gender varchar(10), user_locale varchar(5), user_fb_mail varchar(255) DEFAULT "", user_mail varchar(255), user_phone varchar(30), count int)';
			connection.query(sql, function(err, result) {
				if (err) {
					console.log(err);
					res.end('<script type="text/javascript">document.getElementById("get-members-data").innerHTML = "";document.getElementById("members-count").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
				} else {
					var singleUser = data[index].slice(25);
					if (singleUser.indexOf("profile.php") > -1) {
						singleUser = singleUser.slice(singleUser.indexOf("profile.php")+15);
						singleUser = singleUser.slice(0, singleUser.indexOf("&fref"));
					} else {
						singleUser = singleUser.slice(0, singleUser.indexOf("?fref"));
					}
					var getUserPublicDataOptions = {
						hostname: 'graph.facebook.com',
						port: 443,
						path: '/' + singleUser + '?access_token=777012902368097|RpAQLbUnens5FsiL-NA69odTQGY',
						method: 'GET'
					};
					var getUserPublicDataReq = https.request(getUserPublicDataOptions, function(getUserPublicDataRes) {
						req.session.memberscount = parseInt(req.session.memberscount) + 1;
						res.write('<script type="text/javascript">document.getElementById("members-count-count").innerHTML = "Getting member: ' + req.session.memberscount + '";</script>');
						var returned = '';
						getUserPublicDataRes.on('data', function(chunk) {
							returned += chunk.toString("utf8");
						});
						getUserPublicDataRes.on('end', function () {
							var mail = '';
							if (!JSON.parse(returned).username || JSON.parse(returned).username == null || JSON.parse(returned).username == '') {
								mail = JSON.parse(returned).id + '@facebook.com';
							} else {
								mail = JSON.parse(returned).username + '@facebook.com';
							}
							var user  = {user_id: JSON.parse(returned).id, user_name: JSON.parse(returned).name, user_first_name: JSON.parse(returned).first_name, user_last_name: JSON.parse(returned).last_name, user_username: JSON.parse(returned).username, user_gender: JSON.parse(returned).gender, user_locale: JSON.parse(returned).locale, user_fb_mail: mail, count: 1};
							var sql = 'INSERT IGNORE INTO ' + tableName + ' SET ?';
							connection.query(sql, user, function(err, result) {
								if (err) {
									console.log(err);
									res.end('<script type="text/javascript">document.getElementById("get-members-data").innerHTML = "";document.getElementById("members-count").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
								} else {
									index += 1;
									getGroupUsersPublicData(index, data, ID, req, res);
								}
							});
						});
					});
					getUserPublicDataReq.end();
					getUserPublicDataReq.on('error', function(e) {
						console.log(e);
						res.end('<script type="text/javascript">document.getElementById("get-members-data").innerHTML = "";document.getElementById("members-count").innerHTML = "";document.getElementById("error").innerHTML = "Getting User Details Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
					});
				}
			});
		} else {
			var singleUser = data[index].slice(25);
			if (singleUser.indexOf("profile.php") > -1) {
				singleUser = singleUser.slice(singleUser.indexOf("profile.php")+15);
				singleUser = singleUser.slice(0, singleUser.indexOf("&fref"));
			} else {
				singleUser = singleUser.slice(0, singleUser.indexOf("?fref"));
			}
			var getUserPublicDataOptions = {
				hostname: 'graph.facebook.com',
				port: 443,
				path: '/' + singleUser + '?access_token=777012902368097|RpAQLbUnens5FsiL-NA69odTQGY',
				method: 'GET'
			};
			var getUserPublicDataReq = https.request(getUserPublicDataOptions, function(getUserPublicDataRes) {
				req.session.memberscount = parseInt(req.session.memberscount) + 1;
				res.write('<script type="text/javascript">document.getElementById("members-count-count").innerHTML = "Getting member: ' + req.session.memberscount + '";</script>');
				var returned = '';
				getUserPublicDataRes.on('data', function(chunk) {
					returned += chunk.toString("utf8");
				});
				getUserPublicDataRes.on('end', function () {
					if (JSON.parse(returned).id && JSON.parse(returned).id != null && JSON.parse(returned).id != '') {
						var mail = '';
						if (!JSON.parse(returned).username || JSON.parse(returned).username == null || JSON.parse(returned).username == '') {
							mail = JSON.parse(returned).id + '@facebook.com';
						} else {
							mail = JSON.parse(returned).username + '@facebook.com';
						}
						var user  = {user_id: JSON.parse(returned).id, user_name: JSON.parse(returned).name, user_first_name: JSON.parse(returned).first_name, user_last_name: JSON.parse(returned).last_name, user_username: JSON.parse(returned).username, user_gender: JSON.parse(returned).gender, user_locale: JSON.parse(returned).locale, user_fb_mail: mail, count: 1};
						var sql = 'INSERT IGNORE INTO ' + tableName + ' SET ?';
						connection.query(sql, user, function(err, result) {
							if (err) {
								console.log(err);
								res.end('<script type="text/javascript">document.getElementById("get-members-data").innerHTML = "";document.getElementById("members-count").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
							} else {
								index += 1;
								getGroupUsersPublicData(index, data, ID, req, res);
							}
						});
					} else {
						index += 1;
						getGroupUsersPublicData(index, data, ID, req, res);
					}
				});
			});
			getUserPublicDataReq.end();
			getUserPublicDataReq.on('error', function(e) {
				console.log(e);
				res.end('<script type="text/javascript">document.getElementById("get-members-data").innerHTML = "";document.getElementById("members-count").innerHTML = "";document.getElementById("error").innerHTML = "Getting User Details Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
			});
		}
	} else {
		res.end('<script type="text/javascript">document.getElementById("get-members-data").innerHTML = "";document.getElementById("members-count").innerHTML = "";document.getElementById("error").innerHTML = "";document.getElementById("done").innerHTML = "Got all members public data";document.getElementById("export-ids").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/exportids/id/' + ID + '\'\\">Export users ids</button>";document.getElementById("export-fb-mails").innerHTML = "<button class=\\"btn btn-info btn-flat\\" onclick=\\"window.location = \'/exportfbmails/id/' + ID + '\'\\">Export users facebook mails</button>";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
	}
}
function exportIDs(ID, req, res) {
	var tableName = 'users' + ID;
	var sql = '';
	if (parseInt(req.session.exportidslimit) == 0) {
		sql = 'SELECT user_id FROM ' + tableName;
	} else {
		sql = 'SELECT user_id FROM ' + tableName + ' LIMIT ' + parseInt(req.session.exportidslimit);
	}
	connection.query(sql, function(err, results) {
		if (err) {
			console.log(err);
			res.end("Database Error!");
		} else {
			var streamOptions = { encoding: 'utf8' };
			var wstream = fs.createWriteStream('/tmp/' + tableName + 'ids.txt', streamOptions);
			for (var i = 0; i < results.length; i++) {
				if ((i + 1) == results.length) {
					wstream.write(results[i].user_id);
				} else {
					wstream.write(results[i].user_id + '\r\n');
				}
			}
			wstream.end(function() {
				res.setHeader('Content-Type', 'text/plain');
				res.setHeader("Content-Disposition", "attachment;filename=" + tableName + "ids.txt");
				var filestream = fs.createReadStream('/tmp/' + tableName + 'ids.txt');
				filestream.pipe(res);
				var had_error = false;
				filestream.on('error', function(err) {
					had_error = true;
				});
				filestream.on('close', function() {
					if (!had_error) fs.unlink('/tmp/' + tableName + 'ids.txt');
				});
			});
		}
	});
}
function exportFBMails(ID, req, res) {
	var tableName = 'users' + ID;
	var sql = '';
	if (parseInt(req.session.exportfbmailslimit) == 0) {
		sql = 'SELECT user_fb_mail FROM ' + tableName;
	} else {
		sql = 'SELECT user_fb_mail FROM ' + tableName + ' LIMIT ' + parseInt(req.session.exportfbmailslimit);
	}
	connection.query(sql, function(err, results) {
		if (err) {
			console.log(err);
			res.end("Database Error!");
		} else {
			var streamOptions = { encoding: 'utf8' };
			var wstream = fs.createWriteStream('/tmp/' + tableName + 'mails.txt', streamOptions);
			for (var i = 0; i < results.length; i++) {
				if ((i + 1) == results.length) {
					wstream.write(results[i].user_fb_mail);
				} else {
					wstream.write(results[i].user_fb_mail + '\r\n');
				}
			}
			wstream.end(function() {
				res.setHeader('Content-Type', 'text/plain');
				res.setHeader("Content-Disposition", "attachment;filename=" + tableName + "mails.txt");
				var filestream = fs.createReadStream('/tmp/' + tableName + 'mails.txt');
				filestream.pipe(res);
				var had_error = false;
				filestream.on('error', function(err) {
					had_error = true;
				});
				filestream.on('close', function() {
					if (!had_error) fs.unlink('/tmp/' + tableName + 'mails.txt');
				});
			});
		}
	});
}
function usersData (ID, req, res) {
	var tableName = 'users' + ID;
	var sql = 'SELECT user_id FROM ' + tableName;
	connection.query(sql, function(err, results) {
		if (err) {
			console.log(err);
			res.end('<script type="text/javascript">document.getElementById("get-users-data").innerHTML = "";document.getElementById("users-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "Database Error!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
		} else {
			if (results.length > 0) {
				res.write('<script type="text/javascript">document.getElementById("get-users-data").innerHTML = "Getting users public data...";</script>');
				res.write('<script type="text/javascript">document.getElementById("users-count").innerHTML = "<div id=\\"users-count-count\\" style=\\"margin-bottom: 5px;\\"></div><div class=\\"progress progress-striped active\\"><div class=\\"progress-bar progress-bar-primary\\" style=\\"width: 100%\\" aria-valuemax=\\"100\\" aria-valuemin=\\"0\\" aria-valuenow=\\"100\\" role=\\"progressbar\\"><span class=\\"sr-only\\">Getting users data...</span></div></div>";</script>');
				res.write('<script type="text/javascript">document.getElementById("stop").innerHTML = "<button class=\\"btn btn-danger btn-flat\\" onclick=\\"window.location = \'/users/stop/' + ID + '\'\\">Stop getting users public data</button>";</script>');
				getUserPublicData(0, results, ID, req, res);
			} else {
				res.end('<script type="text/javascript">document.getElementById("get-users-data").innerHTML = "";document.getElementById("users-count").innerHTML = "";document.getElementById("stop").innerHTML = "";document.getElementById("error").innerHTML = "No users for that page!";document.getElementById("done").innerHTML = "";document.getElementById("export-ids").innerHTML = "";document.getElementById("export-fb-mails").innerHTML = "";document.getElementById("back").innerHTML = "<button class=\\"btn btn-github btn-flat\\" onclick=\\"window.location = \'/\'\\">Back</button>";</script>');
			}
		}
	});
}