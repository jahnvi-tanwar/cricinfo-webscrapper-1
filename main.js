let minimist = require("minimist")
let axios = require("axios")
let jsdom = require("jsdom")
let exel4node = require("excel4node")
let pdf = require("pdf-lib")
let fs = require("fs")
let path = require('path');

let args = minimist(process.argv)
console.log(args.source)
console.log(args.excel)
console.log(args.dataFolder)

let responsePromise = axios.get(args.source)
responsePromise.then(function(response){
    let html = response.data;
    console.log("HTML Response got successfully")

    let dom = new jsdom.JSDOM(html)
    let document = dom.window.document
    // let title = document.title for debugging purposes

    let matchInfoDivs = document.querySelectorAll();
    // console.log(matchInfoDivs.length)

    let matches = []
    for(let i = 0; i<matchInfoDivs.length; i++){
        let match = {};

        let nameps = matchInfoDivs[i].querySelectorAll("p.name")

        match.t1 = nameps[0].textContent
        match.t2 = nameps[1].textContent

        let scoreSpans = matchInfoDivs[i].querySelectorAll("span.score")

        if(scoreSpans.length==2){
            match.t1score = scoreSpans[0].textContent
            match.t2score = scoreSpans[1].textContent
        }else if(scoreSpans.length==1){
            match.t1score = scoreSpans[0].textContent
            match.t2score = ""
        }else{
            match.t1score = ""
            match.t2score = ""
        }

        let resultSpan = matchInfoDivs[i].querySelector("div.status-text>span")

        match.result = resultSpan.textContent
        matches.push(match);
    }
    // console.log(matches)
    let teams = []

    for(let i = 0; i<matches.length; i++){
        makeNewTeam(matches[i],teams)
        populateTeam(matches[i],teams)
    }

    let teamsJSON = JSON.stringify(teams)
    fs.writeFileSync("teams.json",teamsJSON,"utf-8")
    
    //creating workbook
    let wb = new exel4node.Workbook();

    //style for headings
    let style = wb.createStyle({
        alignment: { // §18.8.1
            horizontal: ['center']
        },
        font: { 
            bold: true,
        }
    });

    for(let i = 0; i<teams.length; i++){
        // console.log(teams[i])
        createWorkBook(wb, teams[i], style);
    }

    wb.write(args.excel)

    //creating score card

    try{
        fs.rmdirSync(args.dataFolder, { recursive: true });
    }catch(e){}

    fs.mkdirSync(args.dataFolder)

    for(let i = 0; i<teams.length; i++){
        let folderName = path.join(args.dataFolder,teams[i].name)
        fs.mkdirSync(folderName)

        for(let j = 0; j<teams[i].matches.length; j++){
            let fileName = path.join(folderName,teams[i].matches[j].vs)
            createScoreCard(teams[i].name,teams[i].matches[j],fileName)
        }
    }



}).catch(function(err){
    console.log("Error in getting HTML page:")
    console.log(err)
})

function makeNewTeam(match, teams){
    let t1ind = teams.findIndex(t=> t.name==match.t1)

    if(t1ind==-1){
        let newTeam = {
            name:match.t1,
            matches:[]
        }
        teams.push(newTeam)
    }

    let t2ind = teams.findIndex(t=> t.name==match.t2)
    if(t2ind==-1){
        let newTeam = {
            name:match.t2,
            matches:[]
        }
        teams.push(newTeam)
    }
}

function populateTeam(match, teams){
    let t1ind = teams.findIndex(t=> t.name==match.t1)
    teams[t1ind].matches.push({
        vs:match.t2,
        selfScore:match.t1score,
        oppScore:match.t2score,
        result:match.result
    })

    let t2ind = teams.findIndex(t=>t.name==match.t2)
    teams[t2ind].matches.push({
        vs:match.t1,
        selfScore:match.t2score,
        oppScore:match.t1score,
        result:match.result
    })
}

function createWorkBook(workbook, team, style){

    let sheet = workbook.addWorksheet(team.name)
    sheet.cell(2,1).string("vs").style(style)
    sheet.cell(2,2).string("Self Score").style(style)
    sheet.cell(2,3).string("Opposition Score").style(style)
    sheet.cell(2,4).string("Result").style(style)

    for(let i = 0; i<team.matches.length; i++){
        sheet.cell(i+3,1).string(team.matches[i].vs)
        sheet.cell(i+3,2).string(team.matches[i].selfScore)
        sheet.cell(i+3,3).string(team.matches[i].oppScore)
        sheet.cell(i+3,4).string(team.matches[i].result)
    }
}

function createScoreCard(teamName, match, fileName){

    let t1 = teamName
    let t2 = match.vs
    let t1s = match.selfScore
    let t2s = match.oppScore
    let result = match.result

    let templateFileData = fs.readFileSync("template.pdf")
    let templateBytesPromise = pdf.PDFDocument.load(templateFileData)

    templateBytesPromise.then(function(pdfDoc){
        let page = pdfDoc.getPage(0)
        page.drawText(t1,{
            x:155,
            y:726,
            size:10
        })
        page.drawText(t2,{
            x:155,
            y:712,
            size:10
        })
        page.drawText(t1s,{
            x:155,
            y:699,
            size:10
        })
        page.drawText(t2s,{
            x:155,
            y:685,
            size:10
        })
        page.drawText(result,{
            x:155,
            y:670,
            size:10
        })
        let savePromise = pdfDoc.save()
        savePromise.then(function(changedBytes){
            fs.writeFileSync(fileName,changedBytes);
        })
    })
}