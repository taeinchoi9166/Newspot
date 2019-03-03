const express = require('express');
let request = require('request');
let redirectHttp = require('follow-redirects').http;
let router = express.Router();
let session = require('express-session');

let userToken; //임시 토큰 세션
let renderRes; //렌더링 정보 변수
let errorRes = { //오류시 전달할 렌더링 변수
    result:{
        error:''
    }
};
/* GET home page. */
router.get('/', function(req, res, next) {
  let nowPage;
  if(req.query!==undefined&&req.query.nowPage!==undefined){
    nowPage = req.query.nowPage;
  }
  let authURL = 'http://localhost:3000/auth';
  if(nowPage!==undefined){
    authURL=authURL+'?nowPage='+nowPage;
  }
  let result = request.get({uri:authURL,followAllRedirects:true},(err,resp,body)=>{
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
  }
});

router.get('/release',(req,res)=>{
  if(userToken===undefined){
    res.redirect('/?nowPage=release');
    return;
  } //사용자 세션 만료시 받으러 감
  
  let result = request.post('http://localhost:3000/api/release',{form:{token:/*req.session.userToken.access_token*/userToken.access_token}},(err,resp,body)=>{
    console.log(userToken);
    let response = JSON.parse(resp.body);
      if(err||response===undefined){
        errorRes.error = err;
        renderRes = errorRes;
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

router.get('/recommend',(req,res)=>{
  if(userToken===undefined){
    res.redirect('/?nowPage=recommend');
    return;
  } //사용자 세션 만료시 받으러 감
  let genre = "";
  if(req.query!==undefined&&req.query.genre!==undefined) genre = req.query.genre;
  function getGenreList(){
    return new Promise((resolve,reject)=>{
      let result = request.post('http://localhost:3000/api/recommend/getseed',{form:{token:userToken.access_token}},(err,resp,body)=>{
        if(err||resp.body===undefined){
          reject({msg:"error"});
        }else{
          resolve(JSON.parse(resp.body));
        }
      });
    });

  }
  function getRecommendList(){
    return new Promise((resolve,reject)=>{
      let recommendList = request.post('http://localhost:3000/api/recommend/list',{form:{token:userToken.access_token,data:genre}},(err,resp,body)=>{
        if(err||resp.body===undefined){
          reject(err);
        }else{
          resolve(JSON.parse(resp.body));
        }
      });
    });
  }
  function isValidSeed(){
    return new Promise((resolve,reject) => {
      let seedList = request.post('http://localhost:3000/api/recommend/chkseed',{form:{token:userToken.access_token,data:genre}},(err,resp,body)=>{
        if(err||resp.body===undefined){
          reject(err);
        }else{
          const isValid = JSON.parse(resp.body);
          resolve(isValid);
        }
      });
    });
  }
  renderRes = {
    result:{
      genreList:undefined,
      recommendList:undefined
    }
  };

  getGenreList().then((result)=>{
    if(result.genres===undefined){
      renderRes = errorRes;
      renderRes.msg = result.msg;
    }else{
      renderRes.result.genreList = result.genres;
    }
    return isValidSeed();
  }).then((isValid)=>{
    console.log(isValid);
    if(isValid.result){
        return getRecommendList();
    }else{
      return {};
    }
  }).then((result)=>{
    console.log(result);
    if (result !== undefined||result.tracks !== undefined){
      renderRes.result.recommendList = result.tracks;
    }
  }).catch(()=>{
    renderRes = errorRes;
    renderRes.msg = "recommend process error.";
  }).then(() => {
        res.render('spotify/recommend', renderRes);
   });
});
router.get('/search',(req,res)=>{
  let filter = {
    keyword:req.body.keyword,
    popularity:{
      max:req.body.pop_max,
        min:req.body.pop_min
    },
    power:{
      max:req.body.pow_max,
        min:req.body.pow_min
    }
  };

  if(filter.keyword===undefined){
    filter.keyword = "";
  }

  let result = request.post('http://localhost:3000/api/search',{filter:filter},(err,resp,body)=>{
    let response = JSON.parse(body);
    if(err||response===undefined){

    }else{

    }
  });
});

module.exports = router;
