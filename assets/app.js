// Initialize Firebase
var config = {
    apiKey: "AIzaSyAiqedcuwlanvn7xCgrRs0yJyOf4G6ceCE",
    authDomain: "rps-game-81763.firebaseapp.com",
    databaseURL: "https://rps-game-81763.firebaseio.com",
    projectId: "rps-game-81763",
    storageBucket: "",
    messagingSenderId: "817026141804"
};
firebase.initializeApp(config);
//make a database variable
let db = firebase.database();
//declare variables
let userName;
let choice;
let userId;
let dataRef;
let userRef;
let opponentId;
let lobbyRef;
let winCount;
let lossCount;
let drawCount;
let myTurn = false;
//grab the firebase connections reference
let userCons = db.ref('.info/connected');
//make a reference for my lobbies folder on the database
let lobbies = db.ref('/lobbies');
userCons.on("value", function(userList){
    if(userList.val()) {
        //see how many lobbies there are or if there's any
        lobbies.once("value").then(function(lobbiesSnap){
            //if no lobbies, make the first lobby
            if(lobbiesSnap.numChildren() === 0) {
                makeLobby();
            } else {
                let lobbied = false;
                //if there's a lobby already with an empty slot, join it!
                lobbiesSnap.forEach(function(lobbyUsers){
                    if (lobbyUsers.numChildren() === 1) {
                        //add to here, then return true to break forEach
                        let con = lobbyUsers.ref.push(true);
                        lobbyRef = db.ref('/lobbies/' + con.path.n[1]);
                        //assign reference for this user's data
                        userRef = db.ref('/lobbies/' + con.path.n[1] + '/' + con.path.n[2]);
                        //assign a username based off key generated by firebase for userdata folder in lobby
                        userName = con.path.n[2].slice(14)
                        userId = userName;
                        //add default player name
                        changeName(userName);
                        //assign ref for data for this lobby
                        dataRef = db.ref('/lobbyData/dataFor' + con.path.n[1]);
                        let dataCon = dataRef.child('players').push(true);  
                        dataCon.onDisconnect().remove();
                        let playerData = dataRef.child('players').child(dataCon.path.n[3]);
                        playerData.update({
                            Id: userId,
                        });
                        //remove this user from lobby when disconnect
                        con.onDisconnect().remove();
                        //clear all lobby data when this user disconnects
                        dataRef.child('chat').onDisconnect().remove();
                        // dataRef.child('players/' + userName).onDisconnect().remove();                        
                        assignChat();
                        initialScore();
                        assignScore();
                        lobbied = true;
                        chatPrint(userName, "Joined Lobby");
                        changeTurn();
                        //grab opponent reference
                        dataRef.child('players').once("value", function(playerSnap){
                            playerSnap.forEach(function(refSnap){
                                opponentId = refSnap.val().Id;
                                return true;
                            });
                        });
                        assignTurn();
                        return true;
                    }
                });
                //create new lobby
                if(!lobbied) {
                    makeLobby();                             
                }//end if lobbied
            }//end else
        }); //end lobbies.once
    
    } //end if userList.val
}); //end userCons call

function makeLobby() {
    //make a lobby and push to it to create a user
    let con = db.ref('/lobbies/lobby' + Date.now()).push(true);
    //assign reference for this lobby
    lobbyRef = db.ref('/lobbies/' + con.path.n[1]);
    //assign reference for this user's data
    userRef = db.ref('/lobbies/' + con.path.n[1] + '/' + con.path.n[2]);
    //assign a username based off key generated by firebase for userdata folder in lobby
    userName = con.path.n[2].slice(14)
    userId = userName;
    //add default player name
    changeName(userName);
    //assign ref for data for this lobby
    dataRef = db.ref('/lobbyData/dataFor' + con.path.n[1]);
    let dataCon = dataRef.child('players').push(true);  
    dataCon.onDisconnect().remove();
    let playerData = dataRef.child('players').child(dataCon.path.n[3]);
    playerData.update({
        Id: userId,
    });
    //remove this user from lobby when disconnect
    con.onDisconnect().remove();
    //clear all lobby data when this user disconnects
    dataRef.child('chat').onDisconnect().remove();
    initialScore();
    assignScore();
    assignChat();
    chatPrint(userName, "Started Lobby");
    assignTurn();
}

//turn listener assignment
function assignTurn() {
    dataRef.child('data/turns/turn').on("value", function(snap){
        //when move made, take snap data to get turn data,
        //compare to this client's userRef
        let x = snap.val();
        if(x === userId) {
            //if this client's userRef, set var myTurn true, else false
            myTurn = true;
            $('#status').empty();
            $('<li>').html("It's your turn.").appendTo("#status");
        } else {
            myTurn = false;
            opponentId = x;
        }
        //run function to enable/disable RPS buttons based on myTurn boolean
        toggleButtons(myTurn);
    });
    dataRef.child('data/turns').onDisconnect().remove();
}

//change turn fx
function changeTurn () {
    let x;
    if (opponentId) {
        x = opponentId;
    } else {
        x = userId;
    }
    dataRef.child('data/turns').update({
        turn: x,
    });
}


//this fx toggles the client's RPS buttons on/off
function toggleButtons(bool) {
    if(bool) {
        var x = document.getElementById("rpsBtnGrp").querySelectorAll('button');
        for (i = 0; i < x.length; i++) {
            x[i].removeAttribute("disabled");
        }
    } else {
        if(opponentId) {
            $('<li>').html("Waiting for Opponent.").appendTo("#status");                    
        }
        var x = document.getElementById("rpsBtnGrp").querySelectorAll('button');
        for (i = 0; i < x.length; i++) {
            x[i].setAttribute("disabled", "true");
        }
    }
}
//RPS button listener
$('#rpsBtnGrp').on("click", 'button', function(){
    //capture which choice
    choice = $(this).html().toLowerCase();
    //send choice to status
    $('#status').empty();
    $('<li>').html("Your choice: " + choice.toUpperCase()).appendTo('#status');
    //is there a choice there?
    dataRef.child('data/choices').once("value", function(snap){
        if(snap.val()){
            //if choice here, compare and assign winner, then delete that choice
            let oppChoice = snap.val().chose;
            //send opponent choice to DOM
            $('<li>').html("Opponent chose: " + oppChoice.toUpperCase()).appendTo('#status');
            //return bool or other for win/lose
            //call outcome
            outcome(rpsLogic(choice, oppChoice));            
            dataRef.child('data/choices').remove();
        } else {
            //if no choice here, assign current choice
            dataRef.child('data/choices').update({
                chose: choice,
            });
            changeTurn();
        } //end else
    }); //end data ref call
    dataRef.child('data/choices').onDisconnect().remove();
}); //end listener fx

//outcome logic
function outcome(str) {
    //call server and update score
    dataRef.child('data/scores').once("value", function(snap){
        if(snap.val()){
            snap.forEach(function(snapChild){
                //if my score
                if(userId == snapChild.key) {
                    let winNum = snapChild.val().wins;
                    let lossNum = snapChild.val().losses;
                    let drawNum = snapChild.val().draws;                 
                    switch(str) {
                        case 'win':
                            winNum++;
                        break;
                        case 'loss':
                            lossNum++;
                        break;
                        case 'draw':
                            drawNum++;
                        break;
                    }//end switch
                    dataRef.child('data/scores/' + userId).update({
                        wins: winNum,
                        losses: lossNum,
                        draws: drawNum
                    });//end dataRef
                } else {
                    //else my opponents score
                    let winNum = snapChild.val().wins;
                    let lossNum = snapChild.val().losses;
                    let drawNum = snapChild.val().draws;
                    switch(str) {
                        case 'win':
                            lossNum++;
                        break;
                        case 'loss':
                            winNum++;
                        break;
                        case 'draw':
                            drawNum++;
                        break;
                    }//end switch
                    dataRef.child('data/scores/' + snapChild.key).update({
                        wins: winNum,
                        losses: lossNum,
                        draws: drawNum
                    });//end dataref
                } //end else
            });//end forEach
        }//end if snap.val 
    });
}// end outcome fx


//initialize score
function initialScore() {
    winCount = 0;
    lossCount = 0;
    drawCount = 0;
    dataRef.child('data/scores/' + userId).update({
        wins: 0,
        losses: 0,
        draws: 0
    });
    dataRef.child('data/scores/' + userId).onDisconnect().remove();
}

//rps game Logic
function rpsLogic(user, opponent) {
    switch(user){
        case 'rock':
            switch(opponent) {
                case 'rock':
                    return 'draw';
                break;
                case 'paper':
                    return 'loss';
                break;
                case 'scissors':
                    return 'win';
                break;
            } //end rock case switch
        break;
        case 'paper':
            switch(opponent) {
                case 'rock':
                    return 'win';
                break;
                case 'paper':
                    return 'draw';
                break;
                case 'scissors':
                    return 'loss';
                break;
            } //end paper case switch
        break;
        case 'scissors':
            switch(opponent) {
                case 'rock':
                    return 'loss';
                break;
                case 'paper':
                    return 'win';
                break;
                case 'scissors':
                    return 'draw';
                break;
            } //end scissors case switch
        break;
    } //end user switch
} //end rps game logic

function rpsLogicRev(str) {
    switch(str) {
        case 'win':
            switch(choice) {
                case 'rock':
                    return 'scissors';
                break;
                case 'paper':
                    return 'rock';
                break;
                case 'scissors':
                    return 'paper';
                break;
            } //end win case switch
        break;
        case 'loss':
            switch(choice) {
                case 'rock':
                    return 'paper';
                break;
                case 'paper':
                    return 'scissors';
                break;
                case 'scissors':
                    return 'rock';
                break;
            } //end loss case switch
        break;
        case 'draw':
            return str;
        break;
    }//end switch
}

//chat submit button event listener function
$('#enter').on("click", function(event){
    event.preventDefault();
    let str = $('#textInput').val().trim();
    chatPrint(userName, str);
    $('#textInput').val("");
});

function changeName(str) {
    userName = str;
    userRef.update({
        name: userName
    });
}
//clear chat
$('#clear').on("click", function(event){
    event.preventDefault();
    $('#chat').empty();
});

function boardToggle() {
    let flash = 200;
    $('#rps').hide();
    $('#flash').show();
    $('#flash li:nth-child(1)').fadeToggle(flash, function(){$('#flash li:nth-child(1)').fadeToggle(flash)});
    setTimeout(function(){
        $('#flash li:nth-child(2)').fadeToggle(flash, function(){$('#flash li:nth-child(2)').fadeToggle(flash)});
    }, flash * 2);
    setTimeout(function(){
        $('#flash li:nth-child(3)').fadeToggle(flash, function(){$('#flash li:nth-child(3)').fadeToggle(flash)});
    }, flash * 4);
    setTimeout(function(){
        $('#flash li:nth-child(4)').fadeToggle(flash, function(){$('#flash li:nth-child(4)').fadeToggle(flash)});
    }, flash * 6);
    setTimeout(function(){$('#flash').hide()}, flash * 8);
    setTimeout(function(){$('#rps').fadeToggle('slow')}, flash * 8);
}

//assign a listener to DB scores
function assignScore() {
    dataRef.child('data/scores').on("value", function(snap){
        snap.forEach(function(snapChild){
            if(snapChild.key == userId) {
                let wins = snapChild.val().wins;
                let losses = snapChild.val().losses;
                let draws = snapChild.val().draws;
                $('#wins').html("Wins: " + wins);
                $('#losses').html("Losses: " + losses);
                $('#draws').html("Draws: " + draws);
                if(winCount !== wins) {
                    boardToggle()
                    if(!myTurn) {
                        $('#status li:nth-child(2)').html("Opponent chose: " + rpsLogicRev("win").toUpperCase());
                    }
                    $('<li>').html("You won!").appendTo("#status");
                    turnNotice();
                }
                if(lossCount !== losses) {
                    boardToggle()
                    if(!myTurn) {
                        $('#status li:nth-child(2)').html("Opponent chose: " + rpsLogicRev("loss").toUpperCase());
                    }
                    $('<li>').html("You lost!").appendTo("#status");
                    turnNotice();
                }
                if(drawCount !== draws) {
                    boardToggle()
                    if(!myTurn) {
                        $('#status li:nth-child(2)').html("Opponent chose: " + choice.toUpperCase());
                    }
                    $('<li>').html("It was a draw!").appendTo("#status");
                    turnNotice();
                }
                winCount = wins;
                lossCount = losses;
                drawCount = draws;
            }
        });
    });
}

function turnNotice() {
    if(myTurn) {
        $('<li>').html("It's your turn.").appendTo("#status");                    
    } else {
        $('<li>').html("Waiting for Opponent.").appendTo("#status");                    
    }
}
//assign a listener to DB chat message, then pass the most recent data to fx that prints to each user's window
function assignChat() {
    dataRef.child('chat').on("value", function(snap){
        //if statement removes opponent DC console error
        if(snap.val()) {
            chatUpdate(snap.val().msgBy, snap.val().lastMsg);
        } else {
            //use that null error to print a disconnect
            $('#status').empty();
            chatUpdate("System", "<span id='sysMsg'>player disconnected</span>");
        }
    });
}

//parse for commands, if not command, send to database to be read
function chatPrint(name, str) {
    str = parseInput(str);
    if(str !== false) {
        dataRef.child('chat').update({
            lastMsg: str,
            msgBy: name
        });
    }//end if
}

//take input and add it to the chat window
function chatUpdate(name, str) {
    let chatBox = $('#chat');
    // chatBox.append('<p>' + name + ': ' + str + '</p>');
    $('<li>').html(name + ': ' + str).prependTo(chatBox);
}

//this fx returns a random number from 1 - sides, if no arg, sides = 20
function roll(num) {
    let sides = 20;
    if(arguments.length == 1) {
        sides = num;
    }
    return Math.floor(Math.random() * sides) + 1;
}

//this function handles user chat input by calling fx based on if the user entered a string that starts with /
function parseInput(str) {
    if(str.startsWith('/')) {
        let index = str.indexOf(" ");
        let command;
        if(index == -1) {
            command = str.slice(1);
        } else {
            command = str.slice(1, index)
        }
        let helpText = "<span id='sysMsg'><br>Commands:<br>/help : get list of commands<br>/name -new name- : change user name<br>/roll # : rolls a # sided die (if # omitted, # is 20)</span>";
        switch(command.toLowerCase()) {
            case "name":
                let newName = str.slice(index + 1);
                if(index == -1) {
                    chatUpdate("System", "<span id='sysMsg'>Usage: /name -new name- : change user name</span>");
                    return false;
                } else {
                    changeName(newName);
                    return "<span id='sysMsg'>name changed to " + newName + "</span>";
                }
            break;
            case "roll":
                if(index == -1) {
                    return "<span id='sysMsg'>Rolled a 20 sided die! Result: " + roll() + "</span>";
                } else {
                    let int = parseInt(str.slice(index + 1));
                    if(isNaN(int)) {
                        chatUpdate("System", "<span id='sysMsg'>Usage: /roll # : rolls a # sided die</span>");
                        return false;
                    } else {
                        return "<span id='sysMsg'>Rolled a " + int + " sided die! Result: " + roll(int) + "</span>";                        
                    }
                }
            break;
            case "help":
                chatUpdate("System", helpText);
                return false;
            break;
            default:
                chatUpdate("System", "<span id='sysMsg'>try /help for commands</span>");
                return false;
            break;
        }
    } else {
        return str;
    }
}