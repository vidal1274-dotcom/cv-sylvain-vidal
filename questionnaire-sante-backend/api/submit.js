const crypto = require("crypto");

const ALLOWED_ORIGINS = new Set(["https://vidal1274-dotcom.github.io"]);

function cors(req,res){
  const origin=req.headers.origin||"";
  if(ALLOWED_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin",origin);
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
}
function clean(v,max=5000){ return v==null?"":String(v).trim().slice(0,max); }
function md(v){ return clean(v).replace(/\r\n/g,"\n").replace(/\r/g,"\n"); }

function render(data,meta){
  return [
    "# Réponse questionnaire professionnels de santé","",
    `- **Identifiant :** ${meta.id}`,
    `- **Date :** ${meta.receivedAt}`,
    `- **Profession :** ${md(data.profession)||"Non renseignée"}`,
    `- **Coordonnées facultatives :** ${md(data.contact)||"Non renseignées"}`,"",
    "## Logiciels / outils utilisés",md(data.outils)||"—","",
    "## Tâches chronophages",md(data.tachesChronophages)||"—","",
    `## Temps perdu estimé\n${md(data.tempsPerdu)||"—"}`,"",
    "## Tâche à automatiser / simplifier",md(data.automatiser)||"—","",
    `## Ressaisie d'informations\n${md(data.ressaisie)||"—"}`,"",
    "## Solution déjà recherchée",md(data.solutionRecherchee)||"—","",
    "## Changement prioritaire",md(data.changementPrioritaire)||"—","",
    `## Tester un outil complémentaire\n${md(data.testOutil)||"—"}`,"",
    `## Coût logiciel actuel\n${md(data.coutLogiciel)||"—"}`,"",
    `## Tarif justifié\n${md(data.tarifJustifie)||"—"}`,"",
    `## Mode de paiement\n${md(data.modePaiement)||"—"}`,"",
    "## Problème principal",md(data.problemePrincipal)||"—","",
    `## Future maquette\n${data.maquette?"Oui":"Non"}`,"",
    `## Entretien\n${data.entretien?"Oui":"Non"}`,"",
    "## Consentement",data.consentement?"Oui":"Non","",
    "> Aucune donnée patient ne doit être saisie dans ce questionnaire.",""
  ].join("\n");
}

async function save(markdown,meta){
  const token=process.env.GITHUB_TOKEN;
  const repo=process.env.GITHUB_REPO || "vidal1274-dotcom/questionnaire-reponses";
  const branch=process.env.GITHUB_BRANCH || "main";
  if(!token) throw new Error("GITHUB_TOKEN manquant");
  const stamp=meta.receivedAt.replace(/[:.]/g,"-");
  const path=`reponses/${stamp}_${meta.id}.md`;
  const url=`https://api.github.com/repos/${repo}/contents/${path}`;
  const r=await fetch(url,{
    method:"PUT",
    headers:{
      "Authorization":`Bearer ${token}`,
      "Accept":"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      "Content-Type":"application/json",
      "User-Agent":"questionnaire-professionnels-sante"
    },
    body:JSON.stringify({
      message:`Ajoute réponse questionnaire ${meta.id}`,
      content:Buffer.from(markdown,"utf8").toString("base64"),
      branch
    })
  });
  if(!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0,300)}`);
  return path;
}

module.exports=async function handler(req,res){
  cors(req,res);
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method!=="POST") return res.status(405).json({ok:false,error:"Méthode non autorisée"});
  const origin=req.headers.origin||"";
  if(origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ok:false,error:"Origine non autorisée"});
  const raw=req.body||{};
  if(raw.website) return res.status(200).json({ok:true});

  const data={
    profession:clean(raw.profession,300),outils:clean(raw.outils),
    tachesChronophages:clean(raw.tachesChronophages),tempsPerdu:clean(raw.tempsPerdu,100),
    automatiser:clean(raw.automatiser),ressaisie:clean(raw.ressaisie,100),
    solutionRecherchee:clean(raw.solutionRecherchee),changementPrioritaire:clean(raw.changementPrioritaire),
    testOutil:clean(raw.testOutil,100),coutLogiciel:clean(raw.coutLogiciel,100),
    tarifJustifie:clean(raw.tarifJustifie,100),modePaiement:clean(raw.modePaiement,100),
    problemePrincipal:clean(raw.problemePrincipal),maquette:Boolean(raw.maquette),
    entretien:Boolean(raw.entretien),contact:clean(raw.contact,500),
    consentement:Boolean(raw.consentement)
  };
  if(!data.consentement) return res.status(400).json({ok:false,error:"Consentement requis"});
  const useful=[data.profession,data.outils,data.tachesChronophages,data.automatiser,data.problemePrincipal].some(Boolean);
  if(!useful) return res.status(400).json({ok:false,error:"Questionnaire vide"});

  const meta={id:crypto.randomUUID().slice(0,8),receivedAt:new Date().toISOString()};
  try{
    const path=await save(render(data,meta),meta);
    return res.status(200).json({ok:true,id:meta.id,path});
  }catch(e){
    console.error(e);
    return res.status(500).json({ok:false,error:"Impossible d'enregistrer la réponse"});
  }
};