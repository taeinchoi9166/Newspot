const express = require('express');
let request = require('request');
let redirectHttp = require('follow-redirects').http;
let router = express.Router();
let session = require('express-session');

let userToken;
/* GET home page. */
router.get('/', function(req, res, next) {
  let result = request.get({uri:'http://localhost:3000/auth',followAllRedirects:true},(err,resp,body)=>{
   // console.log(result);
    res.redirect(resp.body); //인증 주소로 이동
  });
});
router.get('/index', function(req, res, next) {
  console.log(req.session);
  console.log(userToken);
    res.render('index',{res:JSON.stringify(req.session)});

});

router.post('/auth',(req,res)=>{ //인증 성공 값 보낼시 값들을 세션에 저장
  res.contentType('json');
  const authParams = {
    access_token:req.body.access_token,
    refresh_token:req.body.refresh_token,
    expires_in:req.body.expires_in,
    receivedDate:new Date()
  };
  //console.log(authParams);

  if(authParams.access_token===undefined){
    res.send({successed:false});
  }else{
    req.session.userToken = authParams;
    req.session.save((err)=>{
        if(err){
          throw err;
        }else{
          console.log(req.session.userToken);
          userToken = req.session.userToken;
        }

    });
    res.send({successed:true});
   // console.log(req.session.userToken);



  }
});

router.get('/release',(req,res)=>{
  if(userToken===undefined){
    res.redirect('/');
    return;
  } //사용자 세션 만료시 받으러 감
  
  let result = request.post('http://localhost:3000/api/release',{form:{token:/*req.session.userToken.access_token*/userToken.access_token}},(err,resp,body)=>{
    console.log(userToken);
    let renderRes;
    let response = JSON.parse(resp.body);
      if(err||response===undefined){
        renderRes = {
          result:{
            error:err
          }
        };
        res.render('spotify/release',renderRes);
      }else{
        renderRes = {
          result:{
            songList:response.result,
            artistList:response.artistList
          }
        };
        res.render('spotify/release',renderRes);
      }
  });
  
});

module.exports = router;
