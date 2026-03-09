const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU"

const client = supabase.createClient(
supabaseUrl,
supabaseKey
)

let roomCode = "LOVE-2026"
let maxPlayers = 100

// ======================
// AUTO REJOIN IF REFRESH
// ======================

window.onload = async function(){

if(localStorage.getItem("joined") === "true"){

showWaiting()

// check if round already started
const { data } = await client
.from("game_state")
.select("*")
.limit(1)
.single()

if(data.round_open === true){

showAnswerScreen()

}

}

}

// ======================
// JOIN GAME
// ======================

async function joinGame(){

const name = document.getElementById("name").value
const table = document.getElementById("table").value
const code = document.getElementById("roomcode").value.trim().replace(/\s/g,'').toUpperCase()

if(!name || !table || !code){

document.getElementById("join-error").innerText =
"Please fill in all fields"

return

}


// get game settings
const { data: room } = await client
.from("game_state")
.select("*")
.limit(1)
.single()

roomCode = room.room_code
maxPlayers = room.max_players

// check room code
if(code !== roomCode){

document.getElementById("join-error").innerText =
"Wrong room code"

return

}


// check player count
const { count } = await client
.from("players")
.select("*",{ count:'exact', head:true })
.eq("room_code",roomCode)

if(count >= maxPlayers){

document.getElementById("join-error").innerText =
"Room is full"

return

}


// add player
await client
.from("players")
.insert([{
name:name,
table_no:table,
room_code:roomCode
}])


// save player info locally so refresh works
localStorage.setItem("joined","true")
localStorage.setItem("playerName", name)
localStorage.setItem("tableNo", table)
localStorage.setItem("roomCode", roomCode)  

showWaiting()

updatePlayerCount()

}



// ======================
// SHOW WAITING SCREEN
// ======================

function showWaiting(){

document.getElementById("join-screen").style.display="none"
document.getElementById("waiting-screen").style.display="block"

}

// ======================
// LISTEN FOR ROUND START
// ======================

client
.channel('game_state_updates')
.on(
'postgres_changes',
{
event:'UPDATE',
schema:'public',
table:'game_state'
},
(payload) => {

if(payload.new.round_open === true){

showAnswerScreen()

}

}
)
.subscribe()



// ======================
// SHOW ANSWER SCREEN
// ======================

async function showAnswerScreen(){

// hide all other screens
document.getElementById("join-screen").style.display="none"
document.getElementById("waiting-screen").style.display="none"

// show answer screen
document.getElementById("answer-screen").style.display="block"

// load scenario
const { data } = await client
.from("game_state")
.select("*")
.limit(1)
.single()

document.getElementById("scenario").innerText =
data.scenario

}



// ======================
// SUBMIT ADVICE
// ======================

async function submitAdvice(){

if(localStorage.getItem("submitted") === "true"){

alert("You already submitted!")

return

}

const answer = document.getElementById("answer").value

if(!answer){

return

}


// insert answer
await client
.from("answers")
.insert([{
answer:answer,
scenario_id:1
}])


localStorage.setItem("submitted","true")


document.getElementById("answer-screen").style.display="none"

document.getElementById("submitted-screen").style.display="block"

}


// ======================
// RESET PLAYER STATE (FOR TESTING)
// ======================

function resetGame(){
  localStorage.clear()
  location.reload()
}
