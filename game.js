const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU"

const client = supabase.createClient(
  supabaseUrl,
  supabaseKey
)

let maxAnswers = 100


// ======================
// Load Scenario
// ======================

async function loadScenario(){

const { data, error } = await client
.from("game_state")
.select("*")
.limit(1)
.single()

if(error){
console.log(error)
return
}

document.getElementById("scenario").innerText = data.scenario
maxAnswers = data.max_answers

updateCounter()

}

loadScenario()



// ======================
// Realtime Scenario Updates
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

document.getElementById("scenario").innerText =
payload.new.scenario

}
)
.subscribe()



// ======================
// Realtime Answers Feed
// ======================

client
.channel('answers_feed')
.on(
'postgres_changes',
{
event:'INSERT',
schema:'public',
table:'answers'
},
(payload) => {

const answer = payload.new.answer

let div = document.createElement("div")

div.className = "answer-item"

div.innerText = answer

document.getElementById("answers").prepend(div)

updateCounter()

}
)
.subscribe()



// ======================
// Update Submission Counter
// ======================

async function updateCounter(){

const { count } = await client
.from("answers")
.select("*",{ count:'exact', head:true })

document.getElementById("counter").innerText =
count + " / " + maxAnswers + " submissions"

}



// ======================
// Start Round
// ======================

async function startRound(){

await client
.from("game_state")
.update({ round_open:true })
.eq("id",1)

}



// ======================
// Close Round
// ======================

async function closeRound(){

await client
.from("game_state")
.update({ round_open:false })
.eq("id",1)

}



// ======================
// Next Round
// ======================

async function nextRound(){

await client
.from("answers")
.delete()
.gt("id",0)

document.getElementById("answers").innerHTML = ""

updateCounter()

}
