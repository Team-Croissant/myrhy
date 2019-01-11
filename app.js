var bodyParser = require('body-parser');
var express = require('express');
var session = require('express-session');
var OrientDB = require('orientjs');
var bcrypt = require('bcrypt-nodejs');
var OrientoStore = require('connect-oriento')(session);
var config  = require('./config/config.json');
var bkfd2Password = require("pbkdf2-password");
var hasher = bkfd2Password();
var app = express();
app.locals.pretty = true;
var port = 80;
var userNum = 1;

var server = OrientDB({
   host:config.orient.host,
   port:config.orient.port,
   username:config.orient.username,
   password:config.orient.password
});

var db = server.use(config.orient.db);

app.use(session({
    secret: config.app_pw.secret,
    resave: config.app_pw.resave,
    saveUninitialized: config.app_pw.saveUninitialized,
    store: new OrientoStore({
      server: config.store.server
    })
}));

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('views'));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/auth/logout', function(req, res){
  delete req.session.nickName;
  delete req.session.userName;
  delete req.session.passWord;
  delete req.session.loginedSuccessfully;
  req.session.save(function(){
    res.redirect('/');
  });
});

app.get('/prototype', function(req, res){
  res.render('prototype');
});

app.get('/', function(req, res){
  if(req.session.nickName && req.session.UID) {
    res.redirect('/game');
  } else {
    res.render('index');
    console.log('User' + userNum + ' joined index page.')
    userNum++;
  }
});

app.get('/ping', function(req, res){
  res.send("pong!");
});

app.post('/auth/login', function(req, res){
  var users;
  db.class.get('user').then(function(user){
    var ULength;
    user.list().then(function(User){
      users = User;
      ULength = User.length;
      var userName = req.body.awesomeName;
      var passWord = req.body.verySecuredText;
      for(var i = 0; i < ULength; i++) {
        var user = users[i];
        if(userName === user.userName) {
          return hasher({password: passWord, salt: user.salt}, function(err, pass, salt, hash) {
            if(hash === user.passWord) {
              req.session.nickName = user.nickName;
              req.session.UID = user.userId;
              req.session.loginedSuccessfully = true;
              req.session.save(function(){
                res.redirect('/');
              });
            } else {
              res.render('loginDenined');
            }
          });
        }
      }
      res.render('loginDenined');
    });
  });
});

app.get('/copyright', function(req, res){
  res.render('copyright');
});

app.get('/game', function(req, res){
  if(req.session.loginedSuccessfully) {
    db.record.get('#22:' + req.session.UID)
   .then(
      function(userRecord){
        res.render('game', {nickName: req.session.nickName, UID: req.session.UID, record: JSON.stringify(userRecord.records)});
      }
   );
  } else {
    res.redirect('/');
  }
});

app.get('/sameID', function(req, res){
  res.render('sameID');
});

app.get('/sameName', function(req, res){
  res.render('sameName');
});

app.post('/auth/join', function(req, res){
  allowedFormat = /^[a-zA-Z0-9\!\_]{5,10}$/;
  if(allowedFormat.test(req.body.awesomeName), allowedFormat.test(req.body.personalData), allowedFormat.test(req.body.verySecuredText)) {
    db.class.get('user').then(function(user){
      user.list().then(function(User){
        var ULength = User.length;
        for(var i = 0; i < ULength; i++) {
          var userr = User[i];
          if(req.body.awesomeName == userr.userName) {
            res.redirect('/sameID');
          } else if(req.body.personalData == userr.nickName) {
            res.redirect('/sameName');
          } else {
            return hasher({password:req.body.verySecuredText}, function(err, pass, salt, hash){
              db.class.get('UserRecords').then(function(UserRecords){
                console.log("UserRecords Creating..");
                UserRecords.create({
                  userName: req.body.personalData,
                  userId: ULength
                }).then(function(){
                  console.log("UserRecords Created!");
                  console.log("user Creating..");
                  user.create({
                    userName: req.body.awesomeName,
                    passWord: hash,
                    nickName: req.body.personalData,
                    userId: ULength,
                    salt: salt
                  })
                }).then(function(){
                  console.log("user Created!");
                  res.redirect('/auth/login');
                  console.log("registered.");
                });
              });
            });
            break;
          }
        }
      });
    });
  } else {
    res.redirect('/auth/unAllowedCharacter');
  }
});

app.get('/auth.unAllowedCharacter', function(req, res){
  res.send("허용되지 않은 문자를 입력했거나 공백을 전송했습니다.");
})

app.get('/auth/login', function(req, res){
  if(req.session.nickName && req.session.userName && req.session.passWord) {
    res.redirect('/game');
  } else {
    res.render('login');
  }
});

app.get('/auth/join', function(req, res){
  res.render('join');
});

app.listen(port, function(){
    console.log(`Server running at port ${port}.`);
});
