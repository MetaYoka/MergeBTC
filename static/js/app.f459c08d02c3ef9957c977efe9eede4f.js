(function () {
  var eventHandlers = {};

  // Parse init params from location hash: for Android < 5.0, TDesktop
  var locationHash = '';
  try {
    locationHash = location.hash.toString();
  } catch (e) {}

  var initParams = urlParseHashParams(locationHash);

  var isIframe = false;
  try {
    isIframe = (window.parent != null && window != window.parent);
  } catch (e) {}


  function urlSafeDecode(urlencoded) {
    try {
      return decodeURIComponent(urlencoded);
    } catch (e) {
      return urlencoded;
    }
  }

  function urlParseHashParams(locationHash) {
    locationHash = locationHash.replace(/^#/, '');
    var params = {};
    if (!locationHash.length) {
      return params;
    }
    if (locationHash.indexOf('=') < 0 && locationHash.indexOf('?') < 0) {
      params._path = urlSafeDecode(locationHash);
      return params;
    }
    var qIndex = locationHash.indexOf('?');
    if (qIndex >= 0) {
      var pathParam = locationHash.substr(0, qIndex);
      params._path = urlSafeDecode(pathParam);
      locationHash = locationHash.substr(qIndex + 1);
    }
    var locationHashParams = locationHash.split('&');
    var i, param, paramName, paramValue;
    for (i = 0; i < locationHashParams.length; i++) {
      param = locationHashParams[i].split('=');
      paramName = urlSafeDecode(param[0]);
      paramValue = param[1] == null ? null : urlSafeDecode(param[1]);
      params[paramName] = paramValue;
    }
    return params;
  }

  // Telegram apps will implement this logic to add service params (e.g. tgShareScoreUrl) to game URL
  function urlAppendHashParams(url, addHash) {
    // url looks like 'https://game.com/path?query=1#hash'
    // addHash looks like 'tgShareScoreUrl=' + encodeURIComponent('tgb://share_game_score?hash=very_long_hash123')

    var ind = url.indexOf('#');
    if (ind < 0) {
      // https://game.com/path -> https://game.com/path#tgShareScoreUrl=etc
      return url + '#' + addHash;
    }
    var curHash = url.substr(ind + 1);
    if (curHash.indexOf('=') >= 0 || curHash.indexOf('?') >= 0) {
      // https://game.com/#hash=1 -> https://game.com/#hash=1&tgShareScoreUrl=etc
      // https://game.com/#path?query -> https://game.com/#path?query&tgShareScoreUrl=etc
      return url + '&' + addHash;
    }
    // https://game.com/#hash -> https://game.com/#hash?tgShareScoreUrl=etc
    if (curHash.length > 0) {
      return url + '?' + addHash;
    }
    // https://game.com/# -> https://game.com/#tgShareScoreUrl=etc
    return url + addHash;
  }


  function postEvent (eventType, callback, eventData) {
    if (!callback) {
      callback = function () {};
    }
    if (eventData === undefined) {
      eventData = '';
    }

    if (window.TelegramWebviewProxy !== undefined) {
      TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
      callback();
    }
    else if (window.external && 'notify' in window.external) {
      window.external.notify(JSON.stringify({eventType: eventType, eventData: eventData}));
      callback();
    }
    else if (isIframe) {
      try {
        var trustedTarget = 'https://web.telegram.org';
        // For now we don't restrict target, for testing purposes
        trustedTarget = '*';
        window.parent.postMessage(JSON.stringify({eventType: eventType, eventData: eventData}), trustedTarget);
      } catch (e) {
        callback(e);
      }
    }
    else {
      callback({notAvailable: true});
    }
  };

  function receiveEvent(eventType, eventData) {
    var curEventHandlers = eventHandlers[eventType];
    if (curEventHandlers === undefined ||
        !curEventHandlers.length) {
      return;
    }
    for (var i = 0; i < curEventHandlers.length; i++) {
      try {
        curEventHandlers[i](eventType, eventData);
      } catch (e) {}
    }
  }

  function onEvent (eventType, callback) {
    if (eventHandlers[eventType] === undefined) {
      eventHandlers[eventType] = [];
    }
    var index = eventHandlers[eventType].indexOf(callback);
    if (index === -1) {
      eventHandlers[eventType].push(callback);
    }
  };

  function offEvent (eventType, callback) {
    if (eventHandlers[eventType] === undefined) {
      return;
    }
    var index = eventHandlers[eventType].indexOf(callback);
    if (index === -1) {
      return;
    }
    eventHandlers[eventType].splice(index, 1);
  };

  function openProtoUrl(url) {
    if (!url.match(/^(web\+)?tgb?:\/\/./)) {
      return false;
    }
    var useIframe = navigator.userAgent.match(/iOS|iPhone OS|iPhone|iPod|iPad/i) ? true : false;
    if (useIframe) {
      var iframeContEl = document.getElementById('tgme_frame_cont') || document.body;
      var iframeEl = document.createElement('iframe');
      iframeContEl.appendChild(iframeEl);
      var pageHidden = false;
      var enableHidden = function () {
        pageHidden = true;
      };
      window.addEventListener('pagehide', enableHidden, false);
      window.addEventListener('blur', enableHidden, false);
      if (iframeEl !== null) {
        iframeEl.src = url;
      }
      setTimeout(function() {
        if (!pageHidden) {
          window.location = url;
        }
        window.removeEventListener('pagehide', enableHidden, false);
        window.removeEventListener('blur', enableHidden, false);
      }, 2000);
    }
    else {
      window.location = url;
    }
    return true;
  }

  // For Windows Phone app
  window.TelegramGameProxy_receiveEvent = receiveEvent;

  window.TelegramGameProxy = {
    initParams: initParams,
    receiveEvent: receiveEvent,
    onEvent: onEvent,
    shareScore: function () {
      postEvent('share_score', function (error) {
        if (error) {
          var shareScoreUrl = initParams.tgShareScoreUrl;
          if (shareScoreUrl) {
            openProtoUrl(shareScoreUrl);
          }
        }
      });
    },
    paymentFormSubmit: function (formData) {
      if (!formData ||
          !formData.credentials ||
          formData.credentials.type !== 'card' ||
          !formData.credentials.token ||
          !formData.credentials.token.match(/^[A-Za-z0-9\/=_\-]{4,512}$/) ||
          !formData.title) {
        console.error('[TgProxy] Invalid form data submitted', formData);
        throw Error('PaymentFormDataInvalid');
      }
      postEvent('payment_form_submit', false, formData);
    }
  };

})();
window._CCSettings = {
    platform: "web-mobile",
    groupList: ["default", "bg", "ui", "wall", "fruit", "line", "downwall", ""],
    collisionMatrix: [
        [false, null, null, false],
        [false, false, null, false],
        [false, false, false],
        [false, false, false, false, true, false, false],
        [false, false, false, true, true, true, true, false],
        [false, false, false, false, true, false, false, false],
        [false, false, false, false, true, false, false],
        [false, false, false, false, false, false, false, false]
    ],
    rawAssets: {
        assets: {
            "0": ["default_btn_pressed.png", 1],
            "5": ["music/success.mp3", 4],
            "6": ["music/fry.mp3", 4],
            "8": ["music/merge.mp3", 4],
            "9": ["music/2.mp3", 4],
            "10": ["music/1.mp3", 4],
            "12": ["panel/GameOverLayer.prefab", 5],
            e7ME0lTvlNb4HX93TA0F1d: ["default_btn_pressed", 0, 1],
            "41eopZwPxHZ4viv1Eku0uN": ["panel/LinkIconSpr.prefab", 5]
        },
        internal: {
            "1": ["materials/builtin-unlit.mtl", 3],
            "2": ["effects/builtin-unlit.effect", 2],
            "3": ["effects/builtin-2d-gray-sprite.effect", 2],
            "4": ["materials/builtin-2d-gray-sprite.mtl", 3],
            "13": ["effects/builtin-clear-stencil.effect", 2],
            "14": ["materials/builtin-clear-stencil.mtl", 3],
            "15": ["effects/builtin-2d-spine.effect", 2],
            "16": ["materials/builtin-2d-spine.mtl", 3],
            "28dPjdQWxEQIG3VVl1Qm6T": ["effects/builtin-2d-sprite.effect", 2],
            "796vrvt+9F2Zw/WR3INvx6": ["effects/builtin-unlit-transparent.effect", 2],
            "6fgBCSDDdPMInvyNlggls2": ["materials/builtin-2d-base.mtl", 3],
            "ecpdLyjvZBwrvm+cedCcQy": ["materials/builtin-2d-sprite.mtl", 3]
        }
    },
    assetTypes: ["cc.SpriteFrame", "cc.Texture2D", "cc.EffectAsset", "cc.Material", "cc.AudioClip", "cc.Prefab"],
    launchScene: "db://assets/Scene/MainGameScene.fire",
    scenes: [{
        url: "db://assets/Scene/MainGameScene.fire",
        uuid: 7
    }],
    packedAssets: {
        "04051e2c1": ["00/EFfjElOWId9B1zBG65K", "02delMVqdBD70a/HSD99FK", "03wz9VWTJP94lrgUujqO24", "0cuz27KoVCpb4hmDlhHlr3", "13Le2CPjlOLrw0/JNIcPhM", "13e4vXA9xHvpTR79esXQp0", "174oR9KZhO9JbV7v4xE3ww", "18dkD/iU9H+7Ohh04GiPIx", "19CuZYXWREsbpGboXrMGP5", "292nqIZ1xO0KmLyOv5GA30", "2dUWCjA6RPYJNUO053IAix", "3b5V3m3VBNXbaXHmWjKsC2", "3eX+ScAINKMbfp34P/uuqw", "3eeMUvLbxD7ZE7ax/ZB97n", "3fP1OGfo5L8LridEtJqqUu", "44gs9IhQtCIbDernVZrrVM", "47VjEbQ2RBYLx+KZh29Jdw", "4bGaeeVWZCqr+ZdexT94qU", "4bvNoenrRPVpT4typ0IiYM", "4eGaGBr25O8Yrca6vsF3PA", "50NSZsjfNCNo2Co3Xpeg2c", "536Onqp61NfbovIGjz5l72", "55B21T8f1A/Zf8OhTKEaEK", "55R3S0ssFFOZeGtOQkAavE", "56S6YgalVMvqWmb6Pt2AFR", "5aqToRvfBCNbhG3e32kRzM", "5fkyBCD0JE+p9H4+pJhQgH", "5foCZNrL9Ke4kjwQbsO5IV", "64NDfStvpAaoE9VodJ4IXS", "66Wg7JbENIWJdMAlUU8qDn", "68JBmQV/xDqr8o7ceMaAj/", "69tmDgTPdFhq8xJ8xIlHuN", "6fjigbVlBLXqH+OXUh1wXQ", "71VhFCTINJM6/Ky3oX9nBT", "74I3BXKIBOH4p4bY7wCh9f", "80BrQDyu9PhJ0Z86rVYNs9", "84vJ1Ag9BIDLRqPvWeYD4U", "85YmfQaJFGYKKKPrEQv2OV", "86jDFivHhMf6inDLIoJwD2", "86o1FnGmRDRqw4ROp3tDhh", "8cUqhRmWlHApmXCiyp9Ddz", "8eXVr1cI5KK5Z9V2W4QR5P", "8eqYAPJy1ElJnU5T1Vme7+", "95Thg4bxZLlIVa4u2r4Kl7", "97Qv+7JBJHvby7AJZ8lD7b", "9e2RrV3HVI97HdMNwpBIlp", "a1/pBfYZhKjaDDJClfhDo7", "a5MTATjQNPt4736UDCJ8xh", "a7mM0lQUVLC7/9Ry9Cl36f", "a73hCZ/6tFC421VLUVFP1U", "a8Anh32NZGRZegUtSgEj26", "a9jxOwyflFwacoRm5yk4u8", "adFszcl15Dk657isecN5Xy", "ae0aol/0JF/aec8JnkneKe", "afitiFzU1BsJ9YT23ybH+t", "b03ZhiGzNIV4fzDUXzJfY7", "b1Odi1mLNEHaDvPRc5pU9n", "b3H1GONCxFP4JGDgYZR+Pm", "b4P/PCArtIdIH38t6mlw8Y", "b7kf5xpnlLtrQ0iYcrZFkK", "bbhcqtGR5AtrldfrXaYVA/", "bcssm8oBxAnImERxJEbh8F", "bdWFyvdFFJobLF0Pie0Ma9", "beSMv3mcRKhI9G0SGsi9V1", "c1Xz6l+aBOcLWzVl7eEd8c", "c2HQuONkBIbK+1Y23u1fa4", 0, "cc7MpJSbRMd5fMcB/bbznZ", "d0xnbkCVZKA5Cv/uAoz6vk", "d427JGp29HD4xiQHWNxHj2", "d7dRTX58pMnrD4/mG455OC", "db3w/ze2FJD5VaeYQzbFca", "e36xbamtdCNJlwiRYtcuO/", "e4msy+peJNTJJJTOkm2bmX", "e5J9mN/hBOOan+5gBVTgxD", "e9ROHL+p9Ix5DEwF/vMXb8", "e9yBRNBcRCAbaaFZSgiIsa", "eadLsWqWRFU7BRdOK2gj50", "ebyNd0WWVBbpb4i0TFUlcP", "eb3A6RnrJAtoIRUGGnO7VC", "ffBKvw4z9DIb4QlJDOO2VH", "ffGAgcvZ1IuYRZ9pFs0gwO"],
        "079499991": [1, 2],
        "07ce7530a": [3, 4],
        "095622607": ["00YlSnEflNuL/CoEA+7Zi3", "014XUYxWtOVI8je+XPpJRA", "04ng7y4NFDYLe8ISlFRyOl", "06d8KbeyFHs5nOlrC061nY", "11xoIk6GdAZqsJ1zEb1ZYD", "14zuaqccFAwrYycNdXqwyc", "18O7sCEFdCs6wh8eMgUQQy", "18VYz40WlC559J4uoYkyvh", "1fY+uzTmJIo43Gp6TKhz4J", "21vsDOZSFIy7SF46VmRGvH", "273daJCAFM1JF0aIe+1DSg", "2apY4h391HdqhtGzSmqh4x", "2dK7ELxBtAjIY2QqFDgPv8", "30A8BT8/xDfZ5M3d5atego", "33PQT1T9RFL56FTz0EzFZL", "397fjEi/dAXZx1jkKS0t32", "3bb1xx+nlLNIBodJF+NY8V", "41D7kWhyFGY7q4NDlzkazn", "44CMk6I5BMHLKJXe1arCK4", "44GmLOMUhKr6Ju9ZvDwX5M", "45WPdMDVNEeYYJmK/WEvRQ", "4aAmHV30tL8qqOcoFb/9+7", "4axc2oXOpDv4Pj7dHd6oVN", "4bJHCUiMZAkJWPSuSfgqWX", "4dVswl8VBIjIIWWNoagmMF", "4f54o3c71D/ISx6BQ2Kjob", "52Y5MJGGpDUbP9BPQy9ONn", "5675cd/uhC2pm1bEfEgE8F", "5aJtGAOjVEILw6Z/MuS88O", "5b/52+osZLJaZqAC9qInB9", "5dOV4Jx2FP84EGGTt1wqTo", "61QEQLRKdJTqxqnXU3cJ9o", "622/O3s39CuoJnHkYMOSyE", "630AG9sFBPp7NO1HxfJGG2", "66cgReSWFLu4xMm/mtN/aG", "6cF0aL6NNIBLv2vHfvpMin", "6f6brJUGNIq5or2MhIexcM", "71f749wF5JS4DoUc6NPv0v", "73rtTIsu5B9bZ6sByTSKFK", "7483eySmpO1oAoBaf0Zg1z", "7aS72ysl9BFr71LrnltqNd", "81GX+uVWBMLZ6tPjHkWF0o", "81/anfz7NNVKCtHdbt8dla", "87XaaOHkxEPLjSxc9/bRQw", "89eEhNuWBI95OMkD/zl7q+", "91zjFPskxDTY5P38wP5J9h", "95mhffC/VHl6BpDIlOMmEF", "97fH7DOHpEYpUcBUz6T56S", "97oZBSEUJIdaizDAnWmg+q", "9dMQc1a3JEM4phWNuFFiqV", "9euT2Fb7FM0bETbspmyCDb", "a03/GKZ8BJjIsDTFEkNomr", "a1D/RiOlxHfqoHL4PU462k", 11, "a4MaampVJNALtYMNamUFFY", 5, "a9e42cEw1GppMVPmx5PrjB", "ael56Iw8NBcYnb/PbiUUPe", "afGNetS8tNiL0OzlLNx/6n", "af6GiovU1ADoud5e2OKPeT", "b0oMPq6yVOg6pTzTRP+oDT", 6, 7, "c58adhrhpCzId1+qaXpXxt", "cb/uEilxpFCb2uQZcRS6yt", "cdvOUzNRVCU6GOjRXJmpWn", "d0cbfgUeJBu6n4xGbetPPe", 8, 9, "d5JOsCr1JCF5Rf11pIZNjy", "d58kwgSV9H0oNLRR8gTPdu", "ddPk35BrdEqJiAzXciE97I", "ddT/2edhlFc7ktWmTjlItk", "ddUbctRn9GrrDwlyxtHcNy", "dfHrD9xJpM1IG6WbQFKTUY", "dfv22zjMBB17xkb0BRRalR", "e3bjxRnSFHlIo730zmJ05G", "e4am+fYUhKM6YbwlHn/rpZ", "e7l11YnBxGbbRs3B6mjs2s", "eaoRD6wn9L8ZvoFaS/Q4if", "eeL6kypIhJZ54/EzR7ZlEv", "efvW6eRbRBlJgD8fegz2p/", "f0B4aheHVKL6NNsLTGY4uJ", 10, "f6ZjdhdJxLfZyh9uITVQMn", "f7I1Im7HNJRZs40j48Q/dD", "f8SbpaKgpMsqUXz3OSmLDR", "fa+jRxcdtOhIrqQyzKNPO+", "feTUujkOdEb7+9cpR1dFuO"],
        "0b07e7e0f": ["29FYIk+N1GYaeWH/q1NxQO", "34R3lnfbNMv5L6ZAG+xSeu", "7dMxilsVFO7KhyGLUf8DtC", 11, "d2W5cVv6xIKb70c3bLS1yB", 12, "e97GVMl6JHh5Ml5qEDdSGa", "f9Zm9zf7JK4Iuw7NPuurqV", "faXAasOthBV4dJrGXhhX/8"],
        "0d669730c": [13, 14],
        "0e4bc3b03": [15, 16]
    },
    md5AssetsMap: {},
    orientation: "",
    debug: false,
    subpackages: {},
    uuids: ["c3oZr/VAhL3Ykvi70nVIGv", "2aKWBXJHxKHLvrBUi2yYZQ", "6dkeWRTOBGXICfYQ7JUBnG", "14TDKXr2NJ6LjvHPops74o", "3ae7efMv1CLq2ilvUY/tQi", "a7Q5CubWhI0a029lKkO4aU", "bbVMxP2gVDD74JoNq2RzVi", "c52ohf1dpDO5oKWBAPxgOx", "d2y1pPEzROq4V4p2qgKGRO", "d3FK71kg1E9KomQjw2ZKzG", "f2asWmuOFID7dBzwYIuDuw", "a2MjXRFdtLlYQ5ouAFv/+R", "d42UJPCZRDh5vQjrW6cf9h", "c0BAyVxX9JzZy8EjFrc9DU", "cffgu4qBxEqa150o1DmRAy", "0ek66qC1NOQLjgYmi04HvX", "7a/QZLET9IDreTiBfRn2PD"]
};let _hostUrl = 'https://apicorsair.metayoka.io';
let http = {
    httpRequest(paramObj, fun, errFun) {

        var xmlhttp = null;

        if (window.XMLHttpRequest) {
            xmlhttp = new XMLHttpRequest();
        } else if (window.ActiveXObject) {
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }

        if (xmlhttp == null) {
            alert('unSupport XMLHttp');
            return;
        }

        var httpType = (paramObj.type || 'GET').toUpperCase();

        var dataType = paramObj.dataType || 'json';

        var httpUrl = paramObj.httpUrl || '';

        var async = paramObj.async || true;

        var paramData = paramObj.data || [];
        var requestData = '';
        for (var name in paramData) {
            requestData += name + '=' + paramData[name] + '&';
        }
        requestData = requestData == '' ? '' : requestData.substring(0, requestData.length - 1);
        // console.log(requestData)


        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                fun(xmlhttp.responseText);
            } else {

                errFun;
            }
        }


        if (httpType == 'GET') {
            console.log(paramObj['data']['token'])
            xmlhttp.open("GET", _hostUrl + httpUrl + paramObj['token'], async);
            xmlhttp.send(null);
        } else if (httpType == 'POST') {
            xmlhttp.open("POST", _hostUrl + httpUrl + paramObj['token'], async);

            xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xmlhttp.send(requestData);
        }
    }
}

let api = {
    BASE_URI: "https://apicorsair.metayoka.io",
    userToken: window.location.href.indexOf("?") > 0 ? window.location.href.slice(window.location.href.indexOf("?"), window.location.href.length) : '',
    getUserInfo: "/merge/info",
    getUsersList: "/merge/list",
    setUserScore: "/merge/setscore",
    setUserAddress: "/merge/setaddr",
    setInviter: "/merge/setinviter",
    getInviters: "/merge/inviters"
}
let Service = {
    getUserInfo(cb) {
        if (!api.userToken) {
            return
        }
        console.log(api.userToken, "xxxx")
        let paramObj = {
            httpUrl: api.getUserInfo,
            type: 'post',
            token: api.userToken,
            data: null
        }
        http.httpRequest(paramObj, function (respondDada) {
            cb(JSON.parse(respondDada))
        }, function () {
            cb('Error')
        });
    },
    getUsersList(cb) {
        // if (!api.userToken) {
        //     return
        // }
        let paramObj = {
            httpUrl: api.getUsersList,
            type: 'post',
            token: api.userToken,
            data: null
        };
        http.httpRequest(paramObj, function (respondDada) {
            cb(JSON.parse(respondDada))
        }, function () {
            cb('Error')
        });
    },
    setUsersScore(data, cb) {
        if (!api.userToken) {
            return
        }
        let paramObj = {
            httpUrl: api.setUserScore,
            type: 'post',
            token: api.userToken,
            data: data
        };
        http.httpRequest(paramObj, function (respondDada) {
            cb(JSON.parse(respondDada))
        }, function () {
            cb('Error')
        });
    },
    setUserAddress(data, cb) {
        let paramObj = {
            httpUrl: api.setUserAddress,
            type: 'post',
            token: api.userToken,
            data: data
        };
        http.httpRequest(paramObj, function (respondDada) {
            cb(JSON.parse(respondDada))
        }, function () {
            cb('Error')
        });
    },
    get(type, data, cb) {
        let paramObj = {
            httpUrl: api[type],
            type: 'post',
            token: api.userToken,
            data: data
        };
        http.httpRequest(paramObj, function (respondDada) {
            cb(JSON.parse(respondDada))
        }, function () {
            cb('Error')
        });
    },
}

window.Service = Service;var loadingBool = true;
var loadingNum = 0;
window.boot = function () {

    var settings = window._CCSettings;
    window._CCSettings = undefined;

    if (!settings.debug) {
        var uuids = settings.uuids;

        var rawAssets = settings.rawAssets;
        var assetTypes = settings.assetTypes;
        var realRawAssets = settings.rawAssets = {};
        for (var mount in rawAssets) {
            var entries = rawAssets[mount];
            var realEntries = realRawAssets[mount] = {};
            for (var id in entries) {
                var entry = entries[id];
                var type = entry[1];
                // retrieve minified raw asset
                if (typeof type === 'number') {
                    entry[1] = assetTypes[type];
                }
                // retrieve uuid
                realEntries[uuids[id] || id] = entry;
            }
        }

        var scenes = settings.scenes;
        for (var i = 0; i < scenes.length; ++i) {
            var scene = scenes[i];
            if (typeof scene.uuid === 'number') {
                scene.uuid = uuids[scene.uuid];
            }
        }

        var packedAssets = settings.packedAssets;
        for (var packId in packedAssets) {
            var packedIds = packedAssets[packId];
            for (var j = 0; j < packedIds.length; ++j) {
                if (typeof packedIds[j] === 'number') {
                    packedIds[j] = uuids[packedIds[j]];
                }
            }
        }

        var subpackages = settings.subpackages;
        for (var subId in subpackages) {
            var uuidArray = subpackages[subId].uuids;
            if (uuidArray) {
                for (var k = 0, l = uuidArray.length; k < l; k++) {
                    if (typeof uuidArray[k] === 'number') {
                        uuidArray[k] = uuids[uuidArray[k]];
                    }
                }
            }
        }
    }

    function setLoadingDisplay() {
        // Loading splash scene
        var splash = ge('splash');
        // var progressBar = splash.querySelector('.progress-bar span');
        cc.loader.onProgress = function (completedCount, totalCount, item) {

            loadData.completedCount = completedCount;
            loadData.totalCount = totalCount;

            if (loadingBool) {
                var loadintT = ge("loadingText")
            }
            var percent = 100 * completedCount / totalCount;
            if (loadingBool && loadingNum >= 1 && totalCount > 1) {
                if (percent.toFixed(0) >= 100) {
                    loadintT.innerHTML = 'loading......100' + '%';
                    setTimeout(function () {
                        loadingBool = false;
                        loadintT.remove();
                    }, 0.1 * 1000);
                    clearInterval(timer);
                }
            }
            loadingNum++;

        };
        splash.style.display = 'block';
        // progressBar.style.width = '0%';

        cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function () {
            splash.style.display = 'none';
        });
    }

    var onStart = function () {

        cc.loader.downloader._subpackages = settings.subpackages;

        cc.view.enableRetina(true);
        cc.view.resizeWithBrowserSize(true);

        if (!false && !false) {

            if (cc.sys.isBrowser) {
                setLoadingDisplay();
            }

            if (cc.sys.isMobile) {
                if (settings.orientation === 'landscape') {
                    cc.view.setOrientation(cc.macro.ORIENTATION_LANDSCAPE);
                } else if (settings.orientation === 'portrait') {
                    cc.view.setOrientation(cc.macro.ORIENTATION_PORTRAIT);
                }
                // cc.view.enableAutoFullScreen([
                //     cc.sys.BROWSER_TYPE_BAIDU,
                //     cc.sys.BROWSER_TYPE_WECHAT,
                //     cc.sys.BROWSER_TYPE_MOBILE_QQ,
                //     cc.sys.BROWSER_TYPE_MIUI,
                // ].indexOf(cc.sys.browserType) < 0);
                cc.view.enableAutoFullScreen(false);
            }

            // Limit downloading max concurrent task to 2,
            // more tasks simultaneously may cause performance draw back on some android system / browsers.
            // You can adjust the number based on your own test result, you have to set it before any loading process to take effect.
            if (cc.sys.isBrowser && cc.sys.os === cc.sys.OS_ANDROID) {
                cc.macro.DOWNLOAD_MAX_CONCURRENT = 2;
            }
        }

        var launchScene = settings.launchScene;

        var canvas;

        if (cc.sys.isBrowser) {
            canvas = ge('GameCanvas');
        }
        var launchScene = settings.launchScene;
        console.log("landscape,", launchScene);
        var MainManger = __require("MainManage");
        MainManger.init(launchScene, cc.sys.isBrowser, canvas.style.visibility);

    };

    // jsList
    var jsList = settings.jsList;
    var bundledScript = settings.debug ? 'js/project.dev.js' : 'https://cdn.jsdelivr.net/gh/MetaYoka/MergeBTC/static/js/project.919d0d15be889bef2da1663c0b5b84d8.js';
    if (jsList) {
        jsList = jsList.map(function (x) {
            return 'src/' + x;
        });
        jsList.push(bundledScript);
    } else {
        jsList = [bundledScript];
    }


    var option = {
        id: 'GameCanvas',
        scenes: settings.scenes,
        debugMode: settings.debug ? cc.debug.DebugMode.INFO : cc.debug.DebugMode.ERROR,
        showFPS: !false && settings.debug,
        frameRate: 60,
        jsList: jsList,
        groupList: settings.groupList,
        collisionMatrix: settings.collisionMatrix,
    }

    // init assets
    cc.AssetLibrary.init({
        libraryPath: 'https://cdn.jsdelivr.net/gh/MetaYoka/MergeBTC/res/import',
        rawAssetsBase: 'https://cdn.jsdelivr.net/gh/MetaYoka/MergeBTC/res/raw-',
        rawAssets: settings.rawAssets,
        packedAssets: settings.packedAssets,
        md5AssetsMap: settings.md5AssetsMap,
        subpackages: settings.subpackages
    });

    cc.game.run(option, onStart);
};

window.adsbygoogle = window.adsbygoogle || [];
const adBreak = function (o) {
    adsbygoogle.push(o);
}

function noAdGoToScene() {

    var GameConfig = __require("GameConfig");
    console.log("IndexMainMangerMaing", GameConfig.launchScene, GameConfig.Bros, GameConfig.caS);

    var launchScene = GameConfig.launchScene;
    var Bros = GameConfig.Bros;
    cc.director.loadScene(launchScene, null,
        function () {

            adCompleteFlag = false;

            if (Bros) {
                // show canvas
                var canvas = document.getElementById('GameCanvas');
                canvas.style.visibility = '';
                var div = document.getElementById('GameDiv');
                if (div) {
                    div.style.backgroundImage = '';
                }
            }
            cc.loader.onProgress = null;
            console.log('Success to load scene1Main: ' + launchScene);
        }
    );
}

function ge(id) {
    return document.getElementById(id)
}

var isFirstGame = true

function startGame() {
    zE && zE('messenger:set', 'zIndex', -1);


    ge('homePage').className = 'hidden';
    ge('rankPage').className = 'hidden';

    ge('ad-banner').className="hidden"

    if (!isFirstGame) {
        restartGame()
    }
    isFirstGame = false
}

function restartGame() {
    zE && zE('messenger:set', 'zIndex', -1);

    ge('homePage').className = 'hidden';
    ge('rankPage').className = 'hidden';
    ge('overPage').className = 'hidden';
    ge('ad-banner').className="hidden"

    cc.find("Canvas").getComponent("MainGameJS").RestartGame()
}

function showHomePage() {
    zE('messenger:set', 'zIndex', 100);

    ge('rankPage').className = 'hidden';
    ge('overPage').className = 'hidden';
    ge('homePage').className = 'show';
    ge('ad-banner').className="ad-banner"

}

function showShareView() {
    // ge('lifeDialog').className = 'show';
    toInviteFriend()
}

function hideShareView() {
    ge('lifeDialog').className = 'hidden'
}

function hideRuleView() {
    ge('ruleDialog').className = 'hidden'

}

function showRuleView() {
    ge('ruleDialog').className = 'rule-dialog show';
}

function showRankPage() {
    ge('rankPage').className = 'show'
    // ge('game').className = 'gameHidden'
    ge('homePage').className = 'hidden'
}

function main() {
    console.log("main ..........")
    getInfo()

    getRankList()
}

function getInfo() {
    Service.getUserInfo((res) => {
        if (res.code != 0) {
            return
        }
        userInfo = res['data']['user'];
        //console.log(userInfo, 'userInfo')
        // revive = userInfo['life'];

        ge("userScoreNum").innerHTML = userInfo['spice'];
        ge("integralUserScoreNum").innerHTML = userInfo['spice'];


        if (userInfo['address']) {
            ge('addressContent').innerHTML = addressFilter(userInfo['address']);
            ge('addressContent').className = 'show';
            // ge('changeAddressBtn').className = 'show';
            ge('addAddressBtn').className = 'hidden';
            ge("addressInput").className = 'hidden';
            // ge('cancelChangeAddress').className = 'hidden';
            // ge("addrtips").className = 'hidden'
        } else {
            ge('addressContent').className = 'hidden';
            ge("addressInput").className = 'show';
            // ge('changeAddressBtn').className = 'hidden';
            ge('addAddressBtn').className = 'show';

        };

    })
}


function setUsersAddress() {
    let address = ge('addressInput').value;
    if (!address || address.length !== 42) {
        return
    }
    Service.setUserAddress({
        address: address
    }, (respondData) => {
        getInfo()
    });

}


function addressFilter(address) {
    let _address = address.slice(0, 4);
    _address += "****";
    _address += address.slice(address.length - 4, address.length);
    return _address;
}


function getRankList() {
    var rank_html = '';
    Service.getUsersList((respondData) => {
        if (respondData.code != 0) {
            return
        }
        let rankData = respondData['data']['users'];
        let mineRank = respondData['data']['my'];
        // let rankPercent = (respondData['data']['total'] - respondData['data']['rank']) / (respondData['data']['total'] - 1);
        // TODO userRankPercent
        rankData.map((user, index) => {
            let _rankItemHtml = '<div class="rank-item"><div class="type rank">' +
                '<p class="' + (user.rank > 3 ? 'show' : 'hidden') + '">' + user.rank + '</p>';
            if (user.rank < 4) {
                _rankItemHtml +=
                    '<img src="https://cdn.jsdelivr.net/gh/MetaYoka/MergeBTC/static/images/rank_' + user.rank + '.png">';
            }
            _rankItemHtml += '</div>' +
                ' <div class="type nick-name">';

            if (user.firstname) {
                _rankItemHtml += user.firstname + ' '
            }
            if (user.lastname) {
                _rankItemHtml += user.lastname;
            }
            _rankItemHtml += '</div>' +
                '<div class="type point">' + user['score'] + '</div>' +
                ' <div class="type reward">' + user['spice'] +
                ' <img src="https://cdn.jsdelivr.net/gh/MetaYoka/MergeBTC/static/images/coin.svg?v=0.10" alt="">' +
                '</div>' +
                ' </div>';
            rank_html += _rankItemHtml;
        });
        ge('rankListRank').innerHTML = rank_html;
        ge('rankListOver').innerHTML = rank_html;


        if (mineRank) {
            let mineRankHtml =
                '<div class="type rank">' +
                mineRank.rank +
                '</div><div class="type nick-name">';
            if (mineRank.firstname) {
                mineRankHtml += mineRank.firstname + ' '
            };

            if (mineRank.lastname) {
                mineRankHtml += mineRank.lastname;
            };

            mineRankHtml += '</div><div class="type point"> ' +
                mineRank.score +
                '</div><div class="type reward">' +
                mineRank.spice +
                '<img src="https://cdn.jsdelivr.net/gh/MetaYoka/MergeBTC/static/images/coin.svg?v=0.10" alt=""></div>';

            ge('rankMineRank').innerHTML = mineRankHtml;
            ge('rankMineRank').className = "rank-mine rank-item"
            // ge('rankMineOver').innerHTML = mineRankHtml;
        } else {
            ge('rankMineRank').className = "hidden"
        }
    });
}

function setUserScore(score) {

    let _data = {
        score: score,
        level: 1,
        revived: Number(1),
        revivescore: 1,
        data: ''
    };
    playTimeData = [];
    Service.setUsersScore(_data, (respondData) => {
        if (respondData['data']) {
            ge("userRankPercent").innerHTML = respondData['data']['defeated'];
        }
        // getNetInfo()
        // getUserInfo()

        for (let _index = 0; _index < document.getElementsByClassName('lifeReviveNum').length; _index++) {
            document.getElementsByClassName('lifeReviveNum')[_index].innerHTML = respondData['data']['life'];
        };
    });
}

function hideIntegralView() {
    ge('integralDialog').className = 'hidden';

}

function showIntegralView() {
    ge('integralDialog').className = 'show';
}

function showTips(text, tips) {
    var Url2 = text;
    var oInput = document.createElement('input');
    oInput.value = Url2;
    document.body.appendChild(oInput);
    oInput.select();
    document.execCommand("Copy");
    oInput.className = 'oInput';
    oInput.style.display = 'none';
    ge('message-tip').className = 'show';
    ge('message-tip').innerHTML = tips;
    setTimeout(() => {
        ge('message-tip').className = 'hidden';
    }, 4000);
}


function toInviteFriend() {
    //todo
    TelegramGameProxy.shareScore()
}

function openChat() {
    console.log('openchat');
    zE('messenger', 'open');
    zE('messenger:set', 'zIndex', 1000);
}