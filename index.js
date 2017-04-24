var request = require('request');
var cheerio = require('cheerio');
var async =  require('async');
const fs = require('fs');
var ObjectID = require('mongodb').ObjectID;
var imgur = require('imgur');
var wait=require('wait.for-es6');
var host = "http://thichtruyentranh.com";
var urlStory = "http://thichtruyentranh.com/doraemon/1550.html";
var categoryId = { $oid: "58fc7577e593de00042550f9"};
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
          }
  };
}
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
                                       
                                        request.get("http://uploads.im/api?upload=" + element, {headers: {
                                        'Content-Type': 'application/json'
                                    }}, function(error, response, body){
                                            if (JSON.parse(body).status_code == 200)
                                            {
                                                let link = JSON.parse(body).data.img_url;
                                                callback(null, {index: i, link: link});
                                            }
                                            else
                                            {
                                                callback(null, {index: -1, link: ''});
                                            }
                                            
                                        })
                                    
                                    })
                                    async.parallelLimit(tasks, 10, function(err, result){
                                        result.sort((a, b) => a > b).forEach(function(e){
                                        if (e.index == -1) 
                                        {

                                        }
                                        else imgs.img_main.push({url: e.link});
                                        imgs.img_pre = "http://sk.uploads.im/RA27P.jpg";
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
