let request = require('request');
let cheerio = require('cheerio');
let async =  require('async');
const fs = require('fs');
const Picasa = require('picasa')
let ObjectID = require('mongodb').ObjectID;
let imgur = require('imgur');
let wait=require('wait.for-es6');
const picasa = new Picasa()
let host = "http://thichtruyentranh.com";
let urlStory = "http://thichtruyentranh.com/mat-dao-tieu-kieu-the/8854.html";
let categoryId = { $oid: "58fc7577e593de00042550f9"};
let lstchap = [];
let category = {};
let lstError = [];
imgur.setClientId('bfa81e029d03ca1');
imgAlbum = "KBzEd";

category._id = {
  $oid: "uuidV4()"
};
category.stories = [];

String.prototype.replaceAll = function(search, replacement) {
    let target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};


function getOptions(url){
  return  {
          url: url,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
            'Content-Type':'text/html'
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
        encoding: null,
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
    },
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
let accessToken = "ya29.Gls4BB02ndVB1IQLtAOSAqjiZZeXSVbJGobJui113iztuNxAbSV7QulDrJ8iVUBvxdCwebSidO3nczIoQjD-kfFhznlb7unPbS94nKuJ3ofp2TaAI9bRj5KgETYY";



setInterval(function(){
    fs.readFile(__dirname + '\\' + 'token.txt', 'utf8', function(err, token) {
        accessToken = token;
    });
}, 600000);



let DoneFunction = function(result){
    category.stories = result.map(function(rs){
        return rs._id;
    })
    let filename = 'stories.json';
    fs.writeFile(filename, JSON.stringify(result));
    console.log('Stories data saved in: ' + __dirname + '/' + filename);
    console.log('Total chap: ' + result.length);
    let filename1 = 'category.json';
    fs.writeFile(filename1, JSON.stringify(category));
    console.log('Stories metadata save in: ' + __dirname + '/' + filename1)
    fs.writeFile("errorlog.json", JSON.stringify(lstError));
    
};



function findTextAndReturnRemainder(target, letiable){
    let chopFront = target.substring(target.search(letiable)+letiable.length,target.length);
    let result = chopFront.substring(0,chopFront.search(";"));
    return result;
}

function GetRequestPage(url){
    let req = request.get(getOptions(url), function(error, response, body) {
   
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
              let req = request.get(getOptions(pageLink), function(error, response, body) {
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
                        let req = request(getOptions(item.link), function(error, response, body){
                            if (error)
                            {
                                callback(error, null);
                            }
                            else
                            {
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
                                   
                                    object.date = {
                                        $date: new Date()
                                    };
                                    
                                    object.img_main = [];
                                    object.content = '';
                                    object.cat = categoryId;
                                    callback(null,object);
                                },
                                uploadImage: function(callback){
                                    let imgs = {};
                                    imgs.img_main = [];                       
                                    let arr = [];
                                    let text = $($('script')[5]).text();
                                    let findAndClean = findTextAndReturnRemainder(text,"let imgArray = ");
                                    let re = /\http.*?\" alt="/ig
                                    let match;
                                    while ((match = re.exec(findAndClean)) != null){
                                        let input = match[0];
                                        input = input.substring(0, input.length - 7);
                                        input.replaceAll('%20', '');
                                       arr.push(input);
                                    }

                                    let tasks =  arr.map((element, i) => function(callback){
                                        let req = request.get(getOptionsImage(element), function(err, response, body){
											let wascallback = false;
                                            picasa.postPhoto(accessToken, '6412227004635116865', getPhotoData(body), (error, photo) => {
											if (error || !photo)
											{
                                                if (error.statusCode == 400)
                                                {
                                                    callback(null, {index: -1, link: ''});
                                                    wascallback = true;
                                                }
                                                else
                                                {
                                                     lstError.push(error);
                                                        let numInt = setInterval(function(){
                                                            if (wascallback == true)
                                                            {
                                                                clearInterval(numInt);

                                                            }
                                                            picasa.postPhoto(accessToken, '6412227004635116865', getPhotoData(body), (error, photo) => {
                                                                if (error)
                                                                {
                                                                    lstError.push(error);
                                                                    if (error.statusCode == 400)
                                                                    {
                                                                        
                                                                         clearInterval(numInt);
                                                                         if (wascallback == false)
                                                                         {
                                                                              callback(null, {index: -1, link: ''});
                                                                              wascallback = true;
                                                                         }
                                                                    }
                                                                    else
                                                                    {

                                                                    }
                                                                }
                                                                else
                                                                {
                                                                    clearInterval(numInt);
                                                                    if (wascallback == false)
                                                                    {
                                                                       
                                                                        callback(null, {index: i, link: photo.content.src});
                                                                        wascallback = true;
                                                                    }
                                                                }
                                                            });
                                                        }, 1000);
                                                }
                                                
											}
											
                                            else
                                            {
                                                wascallback = true;
                                                callback(null, {index: i, link: photo.content.src});
                                                
                                            } 
                                               
                                                
                                            })
                                             
                                        });
                                       
                                        

                                    
                                    })
                                    async.parallel(tasks, function(err, result){
										if (err)
                                        {
                                            callback(err, null);
                                            lstError.push(err);
                                        }
                                        result.sort(function(a, b){return a.index-b.index});
                                        result.forEach(function(e){
                                        if (e.index == -1) 
                                        {

                                        }
                                        else imgs.img_main.push({url: e.link});
                                       
                                        })
                                        imgs.img_pre = "https://lh3.googleusercontent.com/-uXOrh4rs2sE/WP2Tcj5poyI/AAAAAAAAB4Q/cKyEthlH9mcGjX5A_v8O2smQh8hqDlGMwCHM/RA27P.jpg";
                                        callback(null, imgs);
                                    });
                                }
                            }, function(err, results) {
                                if (err)
                                {
                                    lstError.push(err);
                                    callback(err, null);
                                }
                                else
                                {
                                    let story = results.getData;
                                    let imgs = results.uploadImage;
                                    story.img_pre = imgs.img_pre;
                                    story.img_main = imgs.img_main;
                                    console.log(story);
                                    callback(null, story);
                                }
                                
                            });
                             
                            }
                            
 
                        });
                      
                        
                    }, function(err, results){
                        if (err)
                        {
                                    lstError.push(err);
                                    callback(err, null);
                        }
                        else callback(null, results);
                    });
                    
              });
             
          }
      })

      async.parallelLimit(taskschap, 5, function(err, result){
          if (err) console.log(err)
          else
          {
              let lstResult = [];
                result.forEach(function(stories){
                    lstResult = lstResult.concat(stories);
                })

                DoneFunction(lstResult);
          }
            
      })
      
      
    }
    
  });
  
}

GetRequestPage(urlStory);
