// URL of your Supabase project
const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co"

// URL of your Supabase project
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU"

// Create a Supabase client so we can read/write database
const client = supabase.createClient(
  supabaseUrl,
  supabaseKey
)

// ===============================
// LOAD GAME DATA
// ===============================

async function loadGame(){

// get current game state
const { data, error } = await client
.from("game_state")
.select("*")
.eq("id",1)
.single()

if(error){
console.error(error)
return
}

// format room code
const formattedCode =
data.room_code.slice(0,4) + "-" + data.room_code.slice(4)

// show room code
document.getElementById("room-code").innerText =
formattedCode


// update player + answer counters
updatePlayerCount()
updateAnswerCount()


// control scenario visibility
if(data.phase === "answering"){

document.getElementById("scenario-card").style.display = "block"

document.getElementById("scenario").innerText =
data.scenario

}
else{

document.getElementById("scenario-card").style.display = "none"

}

}

// Run this function when the page loads
loadGame()

// ===============================
// UPDATE PLAYER COUNT
// ===============================

// This function counts how many players joined
// and updates the lobby display
async function updatePlayerCount(){

// Ask Supabase for the total number of players
const { count } = await client
.from("players")
.select("*",{ count:'exact', head:true })

// Update the text on the screen
document.getElementById("player-count").innerText =
count + " / 100 players joined"

}



// ===============================
// REALTIME PLAYER JOIN LISTENER
// ===============================

// Subscribe to realtime database changes
// whenever someone joins the game
client
.channel("players-channel")
.on(
'postgres_changes',
{
event:'INSERT',      // Trigger when a new row is added
schema:'public',
table:'players'
},
(payload)=>{

// Update the lobby player count
updatePlayerCount()

}
)
.subscribe()



// ===============================
// REALTIME ANSWER FEED
// ===============================

// Listen for new answers submitted by players
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

if(payload.new.phase === "answering"){

document.getElementById("scenario-card").style.display = "block"
document.getElementById("scenario").innerText =
payload.new.scenario

}

if(payload.new.phase === "waiting"){

document.getElementById("scenario-card").style.display = "none"

}

}
)
.subscribe()

// ===============================
// REALTIME ANSWER FEED
// ===============================
console.log("Listening for answers...")

client
.channel("answers-channel")
.on(
'postgres_changes',
{
event:'INSERT',
schema:'public',
table:'answers'
},
async (payload)=>{

const answer = payload.new.answer

const { data: game } = await client
.from("game_state")
.select("round_number")
.eq("id",1)
.single()

if(payload.new.round_number === game.round_number){
spawnAnswerBubble(answer)

updateAnswerCount()

}

}
)
.subscribe()

// ===============================
// HOST CONTROL FUNCTIONS
// ===============================



async function startGame(){

const { data: scenarioData } = await client
.from("scenarios")
.select("*")
.eq("round_number", 1)
.maybeSingle()

await client
.from("game_state")
.update({
round_number: 1,
phase: "answering",
scenario: scenarioData.scenario
})
.eq("id",1)
}


async function nextRound(){

// get current game state
const { data } = await client
.from("game_state")
.select("*")
.eq("id",1)
.single()

const nextRound = data.round_number + 1

// get scenario for next round
const { data: scenarioData } = await client
.from("scenarios")
.select("*")
.eq("round_number", nextRound)
.maybeSingle()

if(!scenarioData){
alert("No more rounds!")
return
}

// update game state
await client
.from("game_state")
.update({
round_number: nextRound,
phase: "answering",
scenario: scenarioData.scenario
})
.eq("id",1)

// clear previous answers
await client
.from("answers")
.delete()
.gt("id",0)

// clear bubbles
document.getElementById("answers").innerHTML=""

}
// ===============================
// use AI later
// ===============================
async function evaluateAnswers(){

// move game to judging phase
await client
.from("game_state")
.update({
phase: "judging"
})
.eq("id",1)

}

// ===============================
// RESET GAME
// ===============================

async function resetGame(){

await client
.from("game_state")
.update({
phase:"waiting",
round_number:1,
scenario:"Waiting for round to start..."
})
.eq("id",1)

// delete all answers
await client
.from("answers")
.delete()
.gt("id",0)

// clear bubbles
document.getElementById("answers").innerHTML=""

// reload state
loadGame()

}

// ===============================
// Spawn bubbles
// ===============================
function spawnAnswerBubble(text){

const bubble = document.createElement("div")

bubble.className = "answer-item"

bubble.innerText = text

// random position
bubble.style.left = Math.random() * 70 + "%"
bubble.style.top = Math.random() * 60 + "%"

document.getElementById("answers").appendChild(bubble)

// remove bubble after animation
setTimeout(()=>{
bubble.remove()
},4000)

}

// ===============================
// UPDATE ANSWER COUNT
// ===============================
async function updateAnswerCount(){

// get game state
const { data: game } = await client
.from("game_state")
.select("round_number, phase")
.eq("id",1)
.single()

// hide counter if waiting
if(game.phase === "waiting"){
document.getElementById("answer-count").style.display = "none"
return
}

// show counter otherwise
document.getElementById("answer-count").style.display = "block"

const round = game.round_number

// count players
const { count: playerCount } = await client
.from("players")
.select("*",{ count:'exact', head:true })

// count answers
const { count: answerCount } = await client
.from("answers")
.select("*",{ count:'exact', head:true })
.eq("round_number", round)

const players = playerCount ?? 0
const answers = answerCount ?? 0

document.getElementById("answer-count").innerText =
answers + " / " + players + " answers received"

}

