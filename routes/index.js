const express = require('express');
let request = require('request');
let redirectHttp = require('follow-redirects').http;
let router = express.Router();
let session = require('express-session');

let userToken; //임시 토큰 세션
let renderRes; //렌더링 정보 변수
let errorRes = { //오류시 전달할 렌더링 변수
    result:{
        msg:''
    }
};
/* GET home page. */
router.get('/', function(req, res, next) {
  if(req.session.userToken!==undefined){
    res.redirect('/index');
    return false;
  }
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
  req.session.userToken = userToken;
  req.session.save((err)=>{

  });
  console.log(userToken);
    res.render('index',{res:JSON.stringify(req.session),result:undefined});

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
          console.log(" session save err");
        }else{
          console.log(req.session.userToken);
          userToken = req.session.userToken;
        }

    });
    res.send({successed:true});
  }
});

router.get('/release',(req,res)=>{
  console.log(req.session.userToken);
  if(userToken===undefined){
    res.redirect('/?nowPage=release');
    return false;
  } //사용자 세션 만료시 받으러 감
  
  let result = request.post('http://localhost:3000/api/release',{form:{token:/*req.session.userToken.access_token*/userToken.access_token}},(err,resp,body)=>{
    console.log(userToken);
    let response = JSON.parse(resp.body);
      if(err||response===undefined){
        errorRes.msg = err;
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
    return false;
  } //사용자 세션 만료시 받으러 감
  let genres = [];
  console.log(req.query.genre);
  if(req.query!==undefined&&req.query.genre!==undefined) genres = req.query.genre;
  function getGenreList(){ //시드 목록 받기
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
  function isValidSeed(){ //시드 값 검사
    return new Promise((resolve,reject) => {
      let seedList = request.post('http://localhost:3000/api/recommend/chkseed',{form:{token:userToken.access_token,data:genres}},(err,resp,body)=>{
        if(err||resp.body===undefined){
          reject(err);
        }else{
          const isValid = JSON.parse(resp.body);
          resolve(isValid);
        }
      });
    });
  }
  function getRecommendList(){ //추천 리스트 받기
    return new Promise((resolve,reject)=>{
      let recommendList = request.post('http://localhost:3000/api/recommend/list',{form:{token:userToken.access_token,data:genres}},(err,resp,body)=>{
        if(err||resp.body===undefined){
          reject(err);
        }else{
          resolve(JSON.parse(resp.body));
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
  if(userToken===undefined){
    res.redirect('/?nowPage=search');
    return false;
  } //사용자 세션 만료시 받으러 감
  renderRes = {
    result:undefined
  };
  if(req.query!==undefined&&req.query.keyword!==undefined){
    let result = request.post('http://localhost:3000/api/search',{form:{token:userToken.access_token,keyword:req.query.keyword,min_popularity:req.query.min_popularity,criteria_date:req.query.criteria_date}},(err,resp,body)=>{
      let response = undefined;
      try{
        response = JSON.parse(body);
      }catch(e){
        console.log("error");
      }
      console.log(response);
      if(err||response===undefined){
        renderRes = errorRes;
        renderRes.result.msg = "search failed.";
      }else{
        renderRes.result ={
          tracks:response.searchResult
        };
      }
      res.render('spotify/search',renderRes);
    });
  }else{
    res.render('spotify/search',renderRes);
  }
});

module.exports = router;
