const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU"

const client = supabase.createClient(
supabaseUrl,
supabaseKey
)

async function submitAdvice(){

let name = document.getElementById("name").value
let answer = document.getElementById("answer").value
let scenario = 1

await client
.from("answers")
.insert([
{ name: name, answer: answer, scenario_id: scenario }
])

alert("Advice submitted!")

}
