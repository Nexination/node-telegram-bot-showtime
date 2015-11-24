var NexinationBot = new function() {
    var main = this;
    var https = require('https');
    var WebSocket = require('ws');
    var fs = require('fs');
    var exec = require('child_process').exec;
    var tbl = require('telegram-bot-api');
    var JsonRpc = require('../../node-modular-chat/chat/js/JsonRpc.js').JsonRpc;
    
    this.telegram = {};
    this.socket = {};
    this.settings = {
        "port": 8080
        , "host": "localhost"
    };
    this.data = {
        "token": ""
        , "users": {
        }
    };
    
    this.connectSocket = function() {
        var uri = 'ws://' + main.settings.host + ':' + main.settings.port + '/nexus/socket';
        main.socket = new WebSocket(uri);
        main.socket.onerror = function(eventObject) {NexinationBot.onSystemMessage(eventObject);};
        main.socket.onclose = function(eventObject) {NexinationBot.onSystemMessage(eventObject);};
        main.socket.onmessage = function(eventObject) {NexinationBot.onMessage(eventObject);};
        main.socket.onopen = function(eventObject) {NexinationBot.onSystemMessage(eventObject);};
        
        return false;
    };
    this.onMessage = function(eventObject) {
        var jsonRpc = main.JsonRpc.parse(eventObject.data);
        console.log(jsonRpc);
        if(jsonRpc.hasOwnProperty('method')) {
            // JSON RPC automatic callback.
            if(jsonRpc.method === 'postMessage' || jsonRpc.method === 'nudge' || jsonRpc.method === 'setPeerCount') {
                main.replyToChat(jsonRpc);
            };
        }
        else if(jsonRpc.hasOwnProperty('result')) {
            //  Add result logic.
        }
        else if(jsonRpc.hasOwnProperty('error')) {
            //  Add error logic.
        };
        
        return false;
    };
    this.onSystemMessage = function(eventObject) {
        console.log('System: ' + eventObject.type);
        
        return false;
    };
    this.register = function(result) {
        if(main.data.users[result.message.chat.id] !== undefined) {
            if(result.message.text === '/settings') {
                child = exec("ps ax | grep '[n]ode'", function (error, stdout, stderr) {
                    console.log('stdout:' + stdout);
                    
                    main.telegram.apiCall(
                        'sendMessage'
                        , {
                            "chatId": result.message.chat.id
                            , "encodedMessage": stdout
                        }
                    );
                    if (error !== null) {
                      console.log('exec error: ' + error);
                    };
                });
            };
        }
        else {
            main.telegram.apiCall(
                'sendMessage'
                , {
                    "chatId": result.message.chat.id
                    , "encodedMessage": "Stop trying to use the damn commands, they are just there for show!"
                }
            );
        };
        
        return false;
    };
    this.messageSend = function(result) {
        var jsonRpc = main.JsonRpc.getRequest();
        jsonRpc.method = 'postMessage';
        jsonRpc.params = {
            "name": result.message.from.username
            , "message": result.message.text
        };
        if(main.socket.readystate === 1 && main.data.users[result.message.chat.id] !== undefined) {
            //console.log(main.socket);
            main.socket.send(JSON.stringify(jsonRpc));
        };
        
        return false;
    };
    this.replyToChat = function(jsonRpc) {
        var encodedMessage = '';
        if(jsonRpc.method === 'postMessage') {
            encodedMessage = jsonRpc.params.name + ": " + jsonRpc.params.message;
        }
        else if(jsonRpc.method === 'setPeerCount') {
            encodedMessage = 'Users: ' + jsonRpc.params.peerCount;
        }
        else if(jsonRpc.method === 'nudge') {
            encodedMessage = '👍';
        };
        var groupId = 0;
        for(var i in main.data.users) {
            groupId = i;
        };
        main.telegram.apiCall(
            'sendMessage'
            , {
                // Group id of the only group allowed to receive replies
                "chatId":groupId
                , "encodedMessage": encodedMessage
            }
        );
        return false;
    };
    this.dataFileAction = function(action, runAfter) {
        var dataFile = 'chatdata';
        if(action === 'load') {
            fs.readFile(
                dataFile
                , function(error, data) {
                    if(!error) {
                        main.data = JSON.parse(data);
                        if(typeof runAfter === 'function') {
                            runAfter();
                        };
                    };
                }
            );
        }
        else if(action === 'save') {
            fs.writeFile(
                dataFile
                , JSON.stringify(main.data)
                , function(error, data) {
                    if(error) {
                        console.log(error);
                    }
                    else if(typeof runAfter === 'function') {
                        runAfter();
                    };
                }
            );
        }
        return false;
    };
    this.runAfterLoad = function() {
        main.telegram = new tbl.TelegramBotLib({"botToken": main.data.token});
        
        main.telegram.on('start', main.register);
        main.telegram.on('help', main.register);
        main.telegram.on('settings', main.register);
        main.telegram.on('default', main.messageSend);
        
        main.connectSocket();
        return false;
    };
    this.__construct = function() {
        main.JsonRpc = new JsonRpc();
        
        main.dataFileAction('load', main.runAfterLoad);
    };
    this.__construct();
};
