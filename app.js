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

if(data.phase === "answering"){
showAnswerScreen()
}

}

}

// ======================
// JOIN GAME
// ======================

async function joinGame(){

// get user inputs
const name = document.getElementById("name").value
const table = document.getElementById("table").value
const code = document.getElementById("roomcode").value
.trim()
.replace(/\s/g,'')
.toUpperCase()

// validate fields
if(!name || !table || !code){

document.getElementById("join-error").innerText =
"Please fill in all fields"

return

}

// get game settings from Supabase
const { data: room, error } = await client
.from("game_state")
.select("*")
.limit(1)
.single()

if(error){
console.error(error)
return
}

const roomCode = room.room_code
const maxPlayers = room.max_players

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
.eq("room_code", roomCode)

if(count >= maxPlayers){

document.getElementById("join-error").innerText =
"Room is full"

return

}

// insert player into database
const { error: insertError } = await client
.from("players")
.insert([{
name: name,
table_no: table,
room_code: roomCode
}])

if(insertError){
console.error(insertError)
return
}

// save player info locally
localStorage.setItem("joined","true")
localStorage.setItem("playerName", name)
localStorage.setItem("tableNo", table)
localStorage.setItem("roomCode", roomCode)

// move to waiting screen
showWaiting()

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

if(
localStorage.getItem("joined") === "true" &&
payload.new.phase === "answering"
){
showAnswerScreen()
}

}
)
.subscribe()



// ======================
// SHOW ANSWER SCREEN
// ======================

async function showAnswerScreen(){

// hide other screens
document.getElementById("join-screen").style.display = "none"
document.getElementById("waiting-screen").style.display = "none"

// check if player already submitted
if(localStorage.getItem("submitted") === "true"){

document.getElementById("submitted-screen").style.display = "block"

return

}

// show answer screen
document.getElementById("answer-screen").style.display = "block"

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

const playerName = localStorage.getItem("playerName")

// get current round
const { data: game } = await client
.from("game_state")
.select("round_number")
.eq("id",1)
.single()

const round = game.round_number

await client
.from("answers")
.insert([{
name: playerName,
answer: answer,
round_number: round
}])

// show error if something failed
if(error){
console.error("Submit error:", error)
alert("Something went wrong submitting your advice.")
return
}

// mark as submitted
localStorage.setItem("submitted","true")

// switch screens
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
