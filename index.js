var request = require('request');
var cheerio = require('cheerio');
var async =  require('async');
const fs = require('fs');
const Picasa = require('picasa')
var ObjectID = require('mongodb').ObjectID;
var imgur = require('imgur');
var wait=require('wait.for-es6');
const picasa = new Picasa()
var host = "http://thichtruyentranh.com";
var urlStory = "http://thichtruyentranh.com/huong-mat-tram-tram/6146.html";
var categoryId = { $oid: "58fc6752e593de00042550f8"};
var lstchap = [];
var category = {};
imgur.setClientId('bfa81e029d03ca1');
imgAlbum = "KBzEd";

category._id = {
  $oid: "uuidV4()"
};
category.stories = [];

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};


function getOptions(url){
  return  {
          url: url,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
          },
          proxy: 'http://proxy.fpt.vn:80'
  };
}

function getOptionsImage(url)
{
    return {
        url: url,
        method: 'GET',
        proxy: 'http://proxy.fpt.vn:80',
        encoding: null
    };
}
function getPhotoData(binaryData){
    return  {
        title       : 'A title',
        summary     : 'Summary or description',
        contentType : 'image/jpeg',             // image/bmp, image/gif, image/png 
        binary      : binaryData
    };
}
var accessToken = "ya29.Gls2BACCFpCbEVuU7qsskL0uPMDtQH3AHDLQwhoj6uBs1sG_iNueIxCQsqxedvz-KUquBaeXHPClYcyHA-S-zksIc_TnJGMiZUsg-a8N1R_8Nl5kqeudfNEBurXa";





var DoneFunction = function(result){
    category.stories = result.map(function(rs){
        return rs._id;
    })
    var filename = 'stories.json';
    fs.writeFile(filename, JSON.stringify(result));
    console.log('Stories data saved in: ' + __dirname + '/' + filename);
    console.log('Total chap: ' + result.length);
    var filename1 = 'category.json';
    fs.writeFile(filename1, JSON.stringify(category));
    console.log('Stories metadata save in: ' + __dirname + '/' + filename1)
    
};



function findTextAndReturnRemainder(target, variable){
    var chopFront = target.substring(target.search(variable)+variable.length,target.length);
    var result = chopFront.substring(0,chopFront.search(";"));
    return result;
}

function GetRequestPage(url){
    request.get(getOptions(url), function(error, response, body) {
   
    if(error) {
      console.log("Error: " + error);
    }
    // Check status code (200 is HTTP OK)
    console.log("Status code: " + response.statusCode);
    if(response.statusCode === 200) {
      // Parse the document body
      let $ = cheerio.load(body, { decodeEntities: false });
      let paging = 0;
      if ($('.paging li a').length == 0)
      {
          paging = 1;
      }
      else paging = +$($('.paging li a')[$('.paging li a').length - 1]).attr('href').split('.')[1];
      
      let pages = [];
      for (let t = 1; t <= paging; t++)
      {
         pages.push(t);
      }
      let taskschap = pages.map(page => {
          return function(callback){
              let lstStories = [];
              let pageLink = url.split('.html')[0] + `/trang.${page}.html`;
              request.get(getOptions(pageLink), function(error, response, body) {
                    let $ = cheerio.load(body, { decodeEntities: false });
                    if ($('.paging li a').length == 0)
                    {
                         $($('.ul_listchap')[0]).find('li').each(function(i, element){
                        let link = host + $(element).find('a').attr('href');
                        let name = $(element).find('a').html();
                        let chap = + $(element).find('span').html();
                        lstStories.push({link: link, name: name, chap: chap});
                        });
                       
                    }
                    else
                    {
                        $($('.ul_listchap')[1]).find('li').each(function(i, element){
                        let link = host + $(element).find('a').attr('href');
                        let name = $(element).find('a').html();
                        let chap = + $(element).find('span').html();
                        lstStories.push({link: link, name: name, chap: chap});
                        });
                    }
                   

                    async.mapSeries(lstStories, function(item, callback){
                        request(getOptions(item.link), function(error, response, body){
                            let $ = cheerio.load(body, { decodeEntities: false });
                            async.parallel({
                                getData: function(callback) {
                                    let object = {};
                                    object._id = {
                                    $oid: new ObjectID().toString('hex')
                                    };
                                  
                                    object.text_pre = '';
                                    object.name = item.name
                                    object.part = item.chap;
                                    var date = $('.content-date').find('span').html().split(' ')[1].split('/');
                                    object.date = {
                                        $date: new Date(2017, date[1] - 1, date[0])
                                    };
                                    
                                    object.img_main = [];
                                    object.content = '';
                                    object.cat = categoryId;
                                    callback(null,object);
                                },
                                uploadImage: function(callback){
                                    var imgs = {};
                                    imgs.img_main = [];                       
                                    var arr = [];
                                    var text = $($('script')[5]).text();
                                    var findAndClean = findTextAndReturnRemainder(text,"var imgArray = ");
                                    var re = /\http.*?\jpg/ig
                                    var match;
                                    while ((match = re.exec(findAndClean)) != null){
                                        var input = match[0];
                                        if (input.indexOf('.jpg') < 0)
                                        {
                                            input += '.jpg';
                                        }
                                        input.replaceAll('%20', '');
                                       arr.push(input);
                                    }

                                    var tasks =  arr.map((element, i) => function(callback){
                                        request.get(getOptionsImage(element), function(err, response, body){
                                            picasa.postPhoto(accessToken, '6412227004635116865', getPhotoData(body), (error, photo) => {
                                               
                                                callback(null, {index: i, link: photo.content.src});
                                            })
                                        });
                                        

                                    
                                    })
                                    async.parallel(tasks, function(err, result){
                                        result.sort(function(a, b){return a.index-b.index});
                                        result.forEach(function(e){
                                        if (e.index == -1) 
                                        {

                                        }
                                        else imgs.img_main.push({url: e.link});
                                        imgs.img_pre = "https://lh3.googleusercontent.com/UV6mDfSMCFrGlfRYYOqJ6EnXh02eznWD09jXK63PbaHmZ6SpdlgySlOyet_QP2QTN54h-bJpF_jmilU7sQhb6-b1GHWe5nzSiVJXgp72GCdGHG7rsZEwet035N8Jm6GYOUEN3LCZhy3MGNJ-NnTXBLbLSr8dHnSb9i7YerKKX-bvi-HxpzQyLgB_mIj8_oYU3HthOKVVi0-BxIm5EcHH6E5lzxWQ5LmgYrgJgk4Cl231iTMoQUBYEc6gjQOBnSDOHeFJmWXo1hGt6Y2ogkyGIw_9SaApU8bC2H6C3Rlkt4s4K3bgGz94ZnIQwLn8rGWOcwuztn8tQiVpMzj75UVDM1QxWuf_HunWfPgehcYF-O_QPVrlqR3DRpTtR0tmpTHGHQWYa730AH-zBOI1IjcsnH_aQQZ_JiNzDwD-ML3MP4QWf61fOR42idU1KSgK9N46Vs-_dXOFylG_Vj6QvYqUrZyxIbirZsHVlLg68-770VBo7qJJGXurKMW4Rtg4afz2hjKcPRHm5n8PqGSEveeR2dgkggN5sXA5LBj9P43VxoULlH2djWjjpHHOpyf2EcyAfdgUGtkXJ3cpMkRMiccC8uHcGBEpkLEk_Vki3tn1CHikE5s4dN-2=w520-h302-no";
                                        })
                                        callback(null, imgs);
                                    });
                                }
                            }, function(err, results) {
                                // results is now equals to: {one: 1, two: 2}
                                let story = results.getData;
                                let imgs = results.uploadImage;
                                story.img_pre = imgs.img_pre;
                                story.img_main = imgs.img_main;
                                console.log(story);
                                callback(null, story);
                            });
                
                        });
                        
                    }, function(err, results){
                       callback(null, results);
                    });

              });
          }
      })

      async.parallel(taskschap, function(err, result){
            var lstResult = [];
            result.forEach(function(stories){
                lstResult = lstResult.concat(stories);
            })
            DoneFunction(lstResult);
      })
      
      
    }
  });
}

GetRequestPage(urlStory);
