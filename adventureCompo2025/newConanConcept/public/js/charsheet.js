// ============================================================
// CHARSHEET.JS — Scheda Personaggio
// Logica adattata da reference/i2.html
// ============================================================

// ── DB ──────────────────────────────────────────────────────
const DB = {
    nomi: {
        maschi:  ["Conan","Kull","Subotai","Connar","Dargan","Khorin","Brann","Targan","Cormac"],
        femmine: ["Sonja","Valeria","Raina","Morrga","Brynn","Shaela","Kara","Tirra","Maevra"]
    },
    eta: {
        "18": { attr: {"DES":1,"FRT":-1} },
        "24": { attr: {"FOR":1,"INT":-1} },
        "34": { attr: {"RES":1,"FRT":-1} },
        "45": { attr: {"INT":1,"FOR":-1} },
        "55": { attr: {"FRT":1,"DES":-1} }
    },
    razze: {
        cimmero:    { nome:"Cimmero",    attr:{"FOR":1,"COS":1,"INT":-1}, res:{"freddo":2,"veleno":1,"acido":1,"fuoco":1}, skills:{"abilita":["Sopravvivenza"],"competenze":["Forza Bruta"]}, tratto:"Infrangibile: ignora un KO a sessione." },
        hyboriano:  { nome:"Hyboriano",  attr:{"INT":1,"FRT":1,"FOR":-1}, res:{"acido":1,"fulmine":1,"fuoco":1,"freddo":1,"veleno":1,"magia":1}, skills:{"abilita":["Adattamento"],"competenze":["Sociale"]}, tratto:"Adattabile: +1 a tutte le Abilita' Sociali." },
        nordheimer: { nome:"Nordheimer", attr:{"FOR":1,"RES":1,"INT":-1}, res:{"freddo":3,"fulmine":2,"acido":1}, skills:{"abilita":["Navigazione"],"competenze":["Remare"]}, tratto:"Figlio del Nord: Ignora penalita' freddo." },
        shemita:    { nome:"Shemita",    attr:{"DES":1,"INT":1,"COS":-1}, res:{"fuoco":3,"veleno":1,"magia":1}, skills:{"abilita":["Mirabilita'"],"competenze":["Arco"]}, tratto:"Nato nelle Sabbie: +1 con Archi." },
        stigiano:   { nome:"Stigiano",   attr:{"INT":1,"FRT":1,"FOR":-1}, res:{"veleno":3,"magia":3,"fuoco":1}, skills:{"abilita":["Occultismo"],"competenze":["Stregoneria"]}, tratto:"Sangue Oscuro: Resiste alla corruzione." },
        zingarano:  { nome:"Zingarano",  attr:{"DES":1,"FRT":1,"RES":-1}, res:{"acido":1,"fulmine":1,"freddo":1}, skills:{"abilita":["Acrobazia"],"competenze":["Furtivita'"]}, tratto:"Marinaio: Nessuna penalita' in combattimento navale." },
        kushita:    { nome:"Kushita",    attr:{"COS":1,"FOR":1,"INT":-1}, res:{"veleno":3,"fuoco":2,"freddo":-1}, skills:{"abilita":["Mimetismo"],"competenze":["Caccia Giungla"]}, tratto:"Pelle d'Ebano: Bonus mimetismo nella giungla." },
        hircano:    { nome:"Hircano",    attr:{"DES":1,"RES":1,"FOR":-1}, res:{"freddo":2,"fulmine":1}, skills:{"abilita":["Equitazione"],"competenze":["Tiro da Cavallo"]}, tratto:"Cavaliere Nato: +2 TxC a cavallo." },
        turaniano:  { nome:"Turaniano",  attr:{"INT":1,"DES":1,"FRT":-1}, res:{"fuoco":1,"magia":1}, skills:{"abilita":["Tattica"],"competenze":["Formazione"]}, tratto:"Disciplinato: Bonus tattica militare." },
        pitto:      { nome:"Pitto",      attr:{"INT":1,"DES":1,"FRT":-1}, res:{"veleno":2,"acido":1,"magia":1}, skills:{"abilita":["Imboscata"],"competenze":["Armi Primitive"]}, tratto:"Predatore: Bonus imboscate nelle foreste." }
    },
    classi: {
        barbaro:    { nome:"Barbaro", sottoclassi:{
            berserker: { nome:"Berserker",          attr:{"FOR":1,"RES":-1}, hp:16, comb:{"dan":3},         skills:{"abilita":["Furia","Intimidire"],"competenze":["Armi a 2 mani","Sfondamento"]} },
            nomade:    { nome:"Nomade",              attr:{"DES":1},          hp:14, comb:{"ini":2,"dan":1}, skills:{"abilita":["Resistenza","Sopravvivenza"],"competenze":["Armi da lancio","Cavalcare"]} }
        }},
        mercenario: { nome:"Mercenario", sottoclassi:{
            condottiero: { nome:"Condottiero",       attr:{"INT":1,"FRT":1},  hp:13, comb:{"att":1,"def":1}, skills:{"abilita":["Leadership","Strategia"],"competenze":["Tattica","Addestramento"]} },
            guardia:     { nome:"Guardia del Corpo", attr:{"COS":1,"DES":-1}, hp:15, comb:{"def":2,"rd":1},  skills:{"abilita":["Combattimento","Percezione"],"competenze":["Scudo","Protezione"]} }
        }},
        ladro:      { nome:"Ladro", sottoclassi:{
            assassino:     { nome:"Assassino",     attr:{"DES":1,"FRT":-1}, hp:9,  comb:{"att":2,"ini":1}, skills:{"abilita":["Furtivita'","Avvelenamento"],"competenze":["Pugnale","Colpo Fatale"]} },
            borseggiatore: { nome:"Borseggiatore", attr:{"DES":1,"FRT":1},  hp:8,  comb:{"ini":3},         skills:{"abilita":["Scassinare","Inganno"],"competenze":["Malizia","Fuga"]} }
        }},
        sciamano:   { nome:"Sciamano Tribale", sottoclassi:{
            guaritore: { nome:"Guerriero degli Spiriti", attr:{"INT":1,"COS":1}, hp:10, comb:{"rd":2}, skills:{"abilita":["Conoscenza Erbe","Evocazioni"],"competenze":["Curare","Riti Tribali"]} },
            veggente:  { nome:"Veggente",                attr:{"INT":2,"FOR":-1},hp:8,  comb:{"ini":2}, skills:{"abilita":["Intuizioni","Divinazione"],"competenze":["Percezione","Comunicazione Spiriti"]} }
        }}
    },
    background: {
        schiavo:    { nome:"Schiavo Liberato",    attr:{"RES":1,"FRT":-1}, hp:5, zecchini:5,   skills:{"abilita":["Sopportazione"],"competenze":["Furtivita'"]} },
        nobile:     { nome:"Nobile Esule",         attr:{"INT":1,"FOR":-1}, hp:0, zecchini:200, skills:{"abilita":["Etichetta"],"competenze":["Scherma"]} },
        cacciatore: { nome:"Cacciatore Selvaggio", attr:{"DES":1,"INT":-1}, hp:2, zecchini:25,  skills:{"abilita":["Sopravvivenza"],"competenze":["Tracciamento"]} },
        soldato:    { nome:"Veterano di Guerra",   attr:{"FOR":1,"FRT":-1}, hp:3, zecchini:50,  skills:{"abilita":["Combattimento"],"competenze":["Disciplina"]} },
        pirata:     { nome:"Pirata/Corsaro",       attr:{"DES":1,"RES":-1}, hp:1, zecchini:100, skills:{"abilita":["Acrobazia"],"competenze":["Equipaggio"]} }
    },
    dei: {
        crom:     { nome:"Crom",     attr:{"FOR":2,"INT":-1},         comb:{"dan":1},         res:{"freddo":1},           hp:0,  bonus:"Il dio non ascolta, ma da' Forza.", fate:0, skills:{"abilita":["Intimidire"],"competenze":["Resistenza"]} },
        mitra:    { nome:"Mitra",    attr:{"RES":1,"DES":-1},         comb:{"def":1},          res:{"magia":1},            hp:0,  bonus:"Giustizia e protezione.", fate:0, skills:{"abilita":["Fede"],"competenze":["Guarigione"]} },
        set:      { nome:"Set",      attr:{"INT":1,"FOR":-1},         comb:{"att":1},          res:{"veleno":2,"magia":1}, hp:-2, bonus:"Rituali antichi e veleni.", fate:0, skills:{"abilita":["Sotterfugio"],"competenze":["Veleni"]} },
        ymir:     { nome:"Ymir",     attr:{"FOR":1,"COS":1,"INT":-1}, comb:{"dan":1,"rd":1},   res:{"freddo":2},           hp:2,  bonus:"Furia del gelo.", fate:0, skills:{"abilita":["Resistenza"],"competenze":["Sopravvivenza"]} },
        bel:      { nome:"Bel",      attr:{"DES":1,"RES":-1},         comb:{"ini":2},          res:{},                     hp:0,  bonus:"Agilita' dei ladri.", fate:0, skills:{"abilita":["Furtivita'"],"competenze":["Ladro"]} },
        ishtar:   { nome:"Ishtar",   attr:{"FRT":1,"COS":1,"FOR":-1}, comb:{"def":1},          res:{},                     hp:5,  bonus:"Fertilita' e vita.", fate:0, skills:{"abilita":["Empatia"],"competenze":["Persuasione"]} },
        antenati: { nome:"Antenati", attr:{"RES":1,"DES":1},          comb:{"att":1,"def":1},  res:{},                     hp:0,  bonus:"Fiducia solo nell'acciaio.", fate:0, skills:{"abilita":["Tradizione"],"competenze":["Armi"]} }
    },
    eventi: {
        villaggio: { nome:"Il Villaggio Bruciato",   fate:1,  attr:{"RES":1,"FRT":-1}, res:{"fuoco":1},  skills:{"abilita":["Sopravvivenza"],"competenze":["Resistenza Fuoco"]} },
        galere:    { nome:"Schiavo nelle Galere",     fate:0,  attr:{"FOR":1,"INT":-1}, res:{},           skills:{"abilita":["Remare"],"competenze":["Sopportazione"]} },
        lupi:      { nome:"Sopravvissuto ai Lupi",    fate:1,  attr:{"DES":1,"FRT":-1}, res:{"freddo":1}, skills:{"abilita":["Istinto"],"competenze":["Percezione"]} },
        tradito:   { nome:"Tradito dal Clan",         fate:-1, attr:{"DES":1,"FRT":-1}, res:{},           skills:{"abilita":["Paranoia"],"competenze":["Sospetto"]} },
        orrore:    { nome:"Ha visto l'Orrore Antico", fate:2,  attr:{"INT":1,"FRT":-2}, res:{"magia":1},  skills:{"abilita":["Ossidiana Mentale"],"competenze":["Resistenza Incanto"]} }
    },
    condotte: {
        acciaio:       { nome:"Acciaio sopra ogni cosa",  attr:{"FOR":1,"INT":-1}, res:{},           comb:{"dan":1},         skills:{"abilita":["Fermezza"],"competenze":["Armatura"]} },
        disonore:      { nome:"Morte prima del disonore", attr:{"RES":1,"DES":-1}, res:{},           comb:{"rd":1},          skills:{"abilita":["Fede"],"competenze":["Tenacia"]} },
        menzogna:      { nome:"Civilta' e' menzogna",     attr:{"FOR":1,"FRT":-1}, res:{},           comb:{"att":1},         skills:{"abilita":["Intimidire"],"competenze":["Urlo di Guerra"]} },
        sangue:        { nome:"Debito di sangue",          attr:{"DES":1,"INT":-1}, res:{},           comb:{"att":1,"def":-1},skills:{"abilita":["Ossessione"],"competenze":["Inseguimento"]} },
        superstizioso: { nome:"Superstizioso",             attr:{"FRT":1,"RES":-1}, res:{"incanto":2},comb:{},               skills:{"abilita":["Riti Propiziatori"],"competenze":["Percezione Magica"]} },
        magia:         { nome:"Diffidenza per la Magia",   attr:{"RES":1,"INT":-1}, res:{"magia":1},  comb:{},               skills:{"abilita":["Purificazione"],"competenze":["Distruzione Magica"]} }
    }
};

// ── FORGIA DB (slot items) ───────────────────────────────────
const FORGIA_DB = {
    Testa: [
        { id:"e_none",  nome:"Nessuno",              rar:"normal",  slot:"Testa",     attr:{},              comb:{},           res:{}, lore:"" },
        { id:"e1",      nome:"Cuffia di Cuoio",      rar:"normal",  slot:"Testa",     attr:{},              comb:{rd:1},       res:{}, lore:"Rozza protezione di pelle conciata." },
        { id:"e2",      nome:"Elmo di Ferro",         rar:"normal",  slot:"Testa",     attr:{},              comb:{def:1},      res:{}, lore:"Elmetto di fattura cimmera." },
        { id:"e3",      nome:"Maschera Stigiana",     rar:"special", slot:"Testa",     attr:{INT:1},         comb:{},           res:{magia:2}, lore:"Bronzo dorato con simboli di Set." },
        { id:"e4",      nome:"Elmo del Grande Orso",  rar:"rare",    slot:"Testa",     attr:{FOR:1,COS:1},   comb:{},           res:{freddo:4}, lore:"Forgiato dalle tribu' nordheimer." },
        { id:"e5",      nome:"Corona di Xaltotun",    rar:"legend",  slot:"Testa",     attr:{INT:2,FRT:1},   comb:{rd:1},       res:{magia:6}, dio:"set",  lore:"Nessun incanto puo' penetrare chi la porta. [SET]" },
        { id:"e_u1",    nome:"Elmo della Tempesta Nera",rar:"unique",slot:"Testa",    attr:{FOR:1,INT:1,DES:1},comb:{att:1,def:1},res:{fulmine:10,magia:4}, dio:"ymir", lore:"Rifiuta ogni maledizione. [YMIR]" }
    ],
    Collo: [
        { id:"a_none",  nome:"Nessuno",               rar:"normal",  slot:"Collo",     attr:{},              comb:{},           res:{}, lore:"" },
        { id:"a1",      nome:"Dente di Lupo",          rar:"normal",  slot:"Collo",     attr:{},              comb:{att:1},      res:{}, lore:"Un dente di lupo-mannaro." },
        { id:"a2",      nome:"Amuleto di Giada",       rar:"special", slot:"Collo",     attr:{RES:1},         comb:{},           res:{veleno:2}, lore:"Giada verde levigata dai sacerdoti." },
        { id:"a3",      nome:"Occhio del Serpente",    rar:"rare",    slot:"Collo",     attr:{INT:1},         comb:{ini:2},      res:{magia:4}, lore:"Dona lucidita' soprannaturale." },
        { id:"a4",      nome:"Cuore di Ahriman",       rar:"legend",  slot:"Collo",     attr:{FRT:3},         comb:{},           res:{magia:10}, dio:"mitra", lore:"Assorbe ogni attacco magico. [MITRA]" },
        { id:"a_u1",    nome:"Occhio di Ibis",         rar:"unique",  slot:"Collo",     attr:{INT:2,FRT:2},   comb:{ini:3},      res:{magia:8,incanto:6}, dio:"mitra", lore:"Rivela l'invisibile. [MITRA]" }
    ],
    Bracciali: [
        { id:"b_none",  nome:"Nessuno",               rar:"normal",  slot:"Bracciali", attr:{},              comb:{},           res:{}, lore:"" },
        { id:"b1",      nome:"Polsini di Cuoio",       rar:"normal",  slot:"Bracciali", attr:{FOR:1},         comb:{},           res:{}, lore:"Semplici rinforzi di cuoio." },
        { id:"b2",      nome:"Bracciali d'Acciaio",    rar:"special", slot:"Bracciali", attr:{},              comb:{def:1,rd:1}, res:{}, lore:"Acciaio temprato di Aquilonia." },
        { id:"b3",      nome:"Bracciali del Re",       rar:"rare",    slot:"Bracciali", attr:{FOR:1,DES:1},   comb:{att:1},      res:{}, lore:"Simbolo di potere e precisione." },
        { id:"b4",      nome:"Morsa di Crom",          rar:"legend",  slot:"Bracciali", attr:{FOR:2},         comb:{dan:2},      res:{}, dio:"crom", lore:"Chi li indossa non lascia la presa. [CROM]" },
        { id:"b_u1",    nome:"Catene Spezzate",        rar:"unique",  slot:"Bracciali", attr:{FOR:2,RES:2},   comb:{dan:3,def:-1},res:{acido:4}, lore:"Il metallo porta ira e resistenza." }
    ],
    Cintura: [
        { id:"c_none",  nome:"Nessuna",               rar:"normal",  slot:"Cintura",   attr:{},              comb:{},           res:{}, lore:"" },
        { id:"c1",      nome:"Cintura di Corda",       rar:"normal",  slot:"Cintura",   attr:{COS:1},         comb:{},           res:{}, lore:"Leggera e robusta." },
        { id:"c2",      nome:"Cintura di Cuoio",       rar:"special", slot:"Cintura",   attr:{RES:1},         comb:{},           res:{}, lore:"Cuoio di toro nero Kushita." },
        { id:"c3",      nome:"Fascia dello Sciamano",  rar:"rare",    slot:"Cintura",   attr:{INT:1,FRT:1},   comb:{},           res:{magia:3}, lore:"Amplifica i rituali spirituali." },
        { id:"c_u1",    nome:"Cintura delle Sabbie",   rar:"unique",  slot:"Cintura",   attr:{DES:2,RES:1},   comb:{ini:2},      res:{fuoco:5,acido:3}, lore:"Rende leggeri come il vento." }
    ],
    AnelloDX: [
        { id:"an_none", nome:"Vuoto",                  rar:"normal",  slot:"AnelloDX",  attr:{},              comb:{},           res:{}, lore:"" },
        { id:"an1",     nome:"Anello di Bronzo",        rar:"normal",  slot:"AnelloDX",  attr:{},              comb:{att:1},      res:{}, lore:"Portato per buona sorte." },
        { id:"an2",     nome:"Sigillo del Ladro",       rar:"special", slot:"AnelloDX",  attr:{DES:1},         comb:{ini:1},      res:{}, lore:"Apre porte chiuse." },
        { id:"an3",     nome:"Anello d'Argento di Set", rar:"rare",    slot:"AnelloDX",  attr:{INT:1},         comb:{},           res:{veleno:4,magia:2}, lore:"Simbolo di potere oscuro." },
        { id:"an4",     nome:"Anello Nero di Thoth-Amon",rar:"legend", slot:"AnelloDX", attr:{INT:2},         comb:{dan:1},      res:{magia:8}, lore:"Chi lo indossa comanda i serpenti." },
        { id:"an_u1",   nome:"Anello del Re Immortale", rar:"unique",  slot:"AnelloDX",  attr:{FRT:3,INT:1},   comb:{def:2},      res:{magia:6,incanto:8}, lore:"Protegge dalla morte certa." }
    ],
    Stivali: [
        { id:"s_none",  nome:"Nessuno",                rar:"normal",  slot:"Stivali",   attr:{},              comb:{},           res:{}, lore:"" },
        { id:"s1",      nome:"Stivali Leggeri",         rar:"normal",  slot:"Stivali",   attr:{DES:1},         comb:{},           res:{}, lore:"Silenziosi come passi su neve." },
        { id:"s2",      nome:"Stivali di Ferro",        rar:"special", slot:"Stivali",   attr:{},              comb:{rd:1},       res:{}, lore:"Un calcio porta il peso di una mazza." },
        { id:"s3",      nome:"Passo del Ghepardo",      rar:"rare",    slot:"Stivali",   attr:{DES:2},         comb:{ini:2},      res:{}, lore:"Il portatore si muove come il felino." },
        { id:"s_u1",    nome:"Sandali di Set",          rar:"unique",  slot:"Stivali",   attr:{DES:2,INT:1},   comb:{ini:3,att:1},res:{veleno:6}, lore:"Grazia e velocita' di serpente." }
    ],
    Torso: [
        { id:"arm_none",nome:"Nessuna",                rar:"normal",  slot:"Torso",     attr:{},              comb:{rd:0},       res:{}, lore:"" },
        { id:"arm1",    nome:"Pelli di Lupo",           rar:"normal",  slot:"Torso",     attr:{},              comb:{rd:1,ini:-1},res:{}, lore:"Calda e resistente." },
        { id:"arm2",    nome:"Cuoio di Aquilonia",      rar:"normal",  slot:"Torso",     attr:{},              comb:{rd:2,ini:-1},res:{}, lore:"Armatura di cuoio indurito." },
        { id:"arm3",    nome:"Scaglie di Bronzo",       rar:"normal",  slot:"Torso",     attr:{},              comb:{rd:3,ini:-2},res:{}, lore:"Squame di bronzo sovrapposte." },
        { id:"arm4",    nome:"Piastre Cimmere",         rar:"normal",  slot:"Torso",     attr:{},              comb:{rd:5,ini:-4},res:{}, lore:"Ferro scuro dei fabbri cimmeri." },
        { id:"arm5",    nome:"Seta Nera Stigiana",      rar:"special", slot:"Torso",     attr:{},              comb:{rd:2,ini:1}, res:{magia:2}, lore:"Fili impregnati di protezione magica." },
        { id:"arm6",    nome:"Cotta di Maglia Nordica", rar:"rare",    slot:"Torso",     attr:{RES:1},         comb:{rd:6,ini:-2},res:{freddo:2}, lore:"Acciaio rinforzato con ossa di drago bianco." },
        { id:"arm7",    nome:"Corazza d'Ossa di Drago", rar:"legend",  slot:"Torso",     attr:{COS:1},         comb:{rd:8,ini:-1},res:{fuoco:4,freddo:2}, lore:"Resistenza soprannaturale." },
        { id:"arm_u1",  nome:"Pelle di Dragone Nero",   rar:"unique",  slot:"Torso",     attr:{COS:2,RES:2},   comb:{rd:10},      res:{fuoco:8,magia:5}, lore:"Immunita' al fuoco." }
    ],
    Scudo: [
        { id:"sc_none", nome:"Nessuno",                rar:"normal",  slot:"Scudo",     attr:{},              comb:{def:0},      res:{}, lore:"" },
        { id:"sc1",     nome:"Scudo Rotondo di Legno", rar:"normal",  slot:"Scudo",     attr:{},              comb:{def:1},      res:{}, lore:"Economico e affidabile." },
        { id:"sc2",     nome:"Scudo Rinforzato",        rar:"normal",  slot:"Scudo",     attr:{},              comb:{def:2,att:-1},res:{}, lore:"Pesante ma impenetrabile." },
        { id:"sc3",     nome:"Egida di Mitra",          rar:"rare",    slot:"Scudo",     attr:{FRT:1},         comb:{def:3},      res:{magia:3}, lore:"Respinge i colpi magici." },
        { id:"sc4",     nome:"Scudo del Leone Aquiloniano",rar:"legend",slot:"Scudo",   attr:{INT:1,FRT:1},   comb:{def:4,att:-1},res:{fuoco:2,magia:2}, lore:"Responsabilita' del trono." },
        { id:"sc_u1",   nome:"Vortice di Kull",         rar:"unique",  slot:"Scudo",     attr:{FRT:2,RES:1},   comb:{def:5,att:1},res:{magia:6,incanto:4}, lore:"Devia ogni attacco." }
    ],
    Arma: [
        { id:"w_none",  nome:"Nessuna",                rar:"normal",  slot:"Arma",      attr:{},              comb:{att:0,dan:0,def:0}, res:{}, elemDan:{}, lore:"" },
        { id:"w1",      nome:"Spada Corta",             rar:"normal",  slot:"Arma",      attr:{},              comb:{att:1,dan:3,def:1}, res:{}, elemDan:{}, lore:"Facile da portare." },
        { id:"w2",      nome:"Spada Lunga",             rar:"normal",  slot:"Arma",      attr:{},              comb:{att:1,dan:4,def:0}, res:{}, elemDan:{}, lore:"La lama di un soldato." },
        { id:"w3",      nome:"Lama di Akbitanan",       rar:"special", slot:"Arma",      attr:{},              comb:{att:2,dan:5,def:1}, res:{}, elemDan:{}, lore:"Acciaio grigio-blu ineguagliabile." },
        { id:"w4",      nome:"Daga del Culto di Set",   rar:"rare",    slot:"Arma",      attr:{INT:1},         comb:{att:3,dan:4,def:2}, res:{}, elemDan:{veleno:2}, lore:"Avvelenata. Danno veleno +2." },
        { id:"w5",      nome:"Lama del Fato di Crom",   rar:"legend",  slot:"Arma",      attr:{FOR:1},         comb:{att:3,dan:12,def:-1},res:{}, elemDan:{}, lore:"Spada di ferro nero." },
        { id:"w6",      nome:"Spada della Fenice",      rar:"legend",  slot:"Arma",      attr:{FRT:1},         comb:{att:4,dan:10,def:2},res:{}, elemDan:{fuoco:3}, lore:"Forgiata nel fuoco." },
        { id:"w_u1",    nome:"Lama di Conan",           rar:"unique",  slot:"Arma",      attr:{FOR:2,DES:1},   comb:{att:5,dan:14,def:2},res:{magia:4}, elemDan:{}, lore:"Taglia il destino stesso." },
        { id:"w_u2",    nome:"Falce di Nergal",         rar:"unique",  slot:"Arma",      attr:{INT:2,FRT:-1},  comb:{att:4,dan:11,def:-1},res:{}, elemDan:{incanto:4}, lore:"Colpisce l'anima." }
    ],
    Arma2M: [
        { id:"a2m_none",nome:"Nessuna",                rar:"normal",  slot:"Arma2M",    attr:{},              comb:{att:0,dan:0},res:{}, elemDan:{}, lore:"" },
        { id:"a2m1",    nome:"Spadone Barbarico",       rar:"normal",  slot:"Arma2M",    attr:{},              comb:{att:-1,dan:8},res:{}, elemDan:{}, lore:"Lama grezza di ferro cimmero." },
        { id:"a2m2",    nome:"Ascia Bipenne",           rar:"normal",  slot:"Arma2M",    attr:{},              comb:{att:-1,dan:9,def:-2},res:{}, elemDan:{}, lore:"Piu' adatta a spaccare porte." },
        { id:"a2m3",    nome:"Lancia Lunga",            rar:"normal",  slot:"Arma2M",    attr:{},              comb:{att:1,dan:5,def:2}, res:{}, elemDan:{}, lore:"Il bastone d'asta tribale." },
        { id:"a2m4",    nome:"Ascia dei Nordheim",      rar:"special", slot:"Arma2M",    attr:{},              comb:{att:1,dan:6},res:{}, elemDan:{freddo:1}, lore:"Incisa con rune." },
        { id:"a2m5",    nome:"Spada Atlantea Antica",   rar:"rare",    slot:"Arma2M",    attr:{INT:1},         comb:{att:2,dan:8}, res:{}, elemDan:{magia:2}, lore:"Il metallo vibra." },
        { id:"a2m6",    nome:"Maglio di Ymir",          rar:"legend",  slot:"Arma2M",    attr:{FOR:2,COS:1},   comb:{att:0,dan:15,def:-2},res:{}, elemDan:{freddo:4}, lore:"Ogni colpo porta tempesta." },
        { id:"a2m_u1",  nome:"Alabarda del Drago Rosso",rar:"unique",  slot:"Arma2M",    attr:{FOR:2,DES:1},   comb:{att:2,dan:13,def:1},res:{}, elemDan:{fuoco:5}, lore:"Brucia all'impatto." }
    ],
    Arco: [
        { id:"arc_none",nome:"Nessuno",                rar:"normal",  slot:"Arco",      attr:{},              comb:{att:0,dan:0},res:{}, elemDan:{}, lore:"" },
        { id:"arc1",    nome:"Arco Corto",              rar:"normal",  slot:"Arco",      attr:{},              comb:{att:1,dan:2}, res:{}, elemDan:{}, lore:"Adatto a distanze brevi." },
        { id:"arc2",    nome:"Arco Lungo Shemita",      rar:"normal",  slot:"Arco",      attr:{},              comb:{att:1,dan:4}, res:{}, elemDan:{}, lore:"I migliori del mondo conosciuto." },
        { id:"arc3",    nome:"Arco del Vento",          rar:"special", slot:"Arco",      attr:{DES:1},         comb:{att:2,dan:4}, res:{}, elemDan:{}, lore:"Non perde mai la mira." },
        { id:"arc4",    nome:"Arco di Corno di Drago",  rar:"rare",    slot:"Arco",      attr:{DES:1,FOR:1},   comb:{att:3,dan:6}, res:{}, elemDan:{}, lore:"Frecce dritte anche controvento." },
        { id:"arc_u1",  nome:"Arco della Stella Cadente",rar:"unique", slot:"Arco",     attr:{DES:3},         comb:{att:4,dan:8,ini:2}, res:{}, elemDan:{magia:3}, lore:"Frecce come luce." }
    ]
};

// ── FORGIA GENERAZIONE CASUALE ───────────────────────────────
const FORGIA_GEN = {
    adj: {
        "Rozzo":{"ms":"Rozzo","fs":"Rozza","mp":"Rozzi","fp":"Rozze"},
        "Antico":{"ms":"Antico","fs":"Antica","mp":"Antichi","fp":"Antiche"},
        "Cimmero":{"ms":"Cimmero","fs":"Cimmera","mp":"Cimmeri","fp":"Cimmere"},
        "Nordico":{"ms":"Nordico","fs":"Nordica","mp":"Nordici","fp":"Nordiche"},
        "Maledetto":{"ms":"Maledetto","fs":"Maledetta","mp":"Maledetti","fp":"Maledette"},
        "Sacro":{"ms":"Sacro","fs":"Sacra","mp":"Sacri","fp":"Sacre"},
        "Oscuro":{"ms":"Oscuro","fs":"Oscura","mp":"Oscuri","fp":"Oscure"}
    },
    bases: {
        "Arma":   [{n:"Spada",g:"f",s:"s"},{n:"Ascia",g:"f",s:"s"},{n:"Daga",g:"f",s:"s"},{n:"Mazza",g:"f",s:"s"}],
        "Arma2M": [{n:"Spadone",g:"m",s:"s"},{n:"Maglio",g:"m",s:"s"},{n:"Alabarda",g:"f",s:"s"}],
        "Arco":   [{n:"Arco Corto",g:"m",s:"s"},{n:"Arco Lungo",g:"m",s:"s"}],
        "Scudo":  [{n:"Scudo Rotondo",g:"m",s:"s"},{n:"Pavese",g:"m",s:"s"}],
        "Torso":  [{n:"Usbergo",g:"m",s:"s"},{n:"Corazza",g:"f",s:"s"},{n:"Piastre",g:"f",s:"p"}],
        "Testa":  [{n:"Elmo",g:"m",s:"s"},{n:"Maschera",g:"f",s:"s"}],
        "Collo":  [{n:"Amuleto",g:"m",s:"s"},{n:"Collana",g:"f",s:"s"}],
        "Bracciali":[{n:"Bracciali",g:"m",s:"p"}],
        "Cintura":[{n:"Cintura",g:"f",s:"s"}],
        "AnelloDX":[{n:"Anello",g:"m",s:"s"}],
        "Stivali":[{n:"Stivali",g:"m",s:"p"}]
    },
    suffixes: ["di Crom","di Mitra","di Set","del Sangue","del Destino","delle Ombre","del Ghiaccio","della Tempesta","del Serpente","della Fenice"],
    slotWeights: {
        "Arma":     {attr:0.6,combat:1.2,res:0.2,main:"dan"},
        "Arma2M":   {attr:0.8,combat:1.6,res:0.2,main:"dan"},
        "Arco":     {attr:0.5,combat:1.0,res:0.1,main:"att"},
        "Scudo":    {attr:0.4,combat:0.9,res:0.8,main:"def"},
        "Torso":    {attr:0.7,combat:1.0,res:1.4,main:"rd"},
        "Testa":    {attr:0.5,combat:0.7,res:0.8,main:"rd"},
        "Collo":    {attr:1.4,combat:0.5,res:1.1,main:"hp"},
        "Bracciali":{attr:0.9,combat:0.8,res:0.4,main:"att"},
        "Cintura":  {attr:1.0,combat:0.5,res:0.5,main:"hp"},
        "AnelloDX": {attr:1.5,combat:0.6,res:1.0,main:"magia"},
        "Stivali":  {attr:0.6,combat:1.0,res:0.4,main:"ini"}
    },
    rarityPower: {
        "normal":  {attrMax:0,combMax:2,resMax:1,  attrPts:0,combPts:1,resPts:1},
        "special": {attrMax:1,combMax:3,resMax:3,  attrPts:1,combPts:2,resPts:2},
        "rare":    {attrMax:2,combMax:4,resMax:5,  attrPts:2,combPts:3,resPts:3},
        "legend":  {attrMax:3,combMax:5,resMax:8,  attrPts:3,combPts:4,resPts:4},
        "unique":  {attrMax:4,combMax:6,resMax:12, attrPts:4,combPts:6,resPts:6}
    },
    rarLore: {
        "normal":  ["Un oggetto grezzo ma funzionale.","Fattura rozza, ma regge.","Semplice e affidabile."],
        "special": ["Porta segni di magia minore.","Insolita qualita' per un oggetto comune."],
        "rare":    ["Un artigiano eccezionale lo ha forgiato.","Incantesimi di livello medio lo proteggono."],
        "legend":  ["Forgiato in un'era perduta.","Il suo potere e' palpabile."],
        "unique":  ["Un solo esemplare nel mondo conosciuto.","Il destino stesso sembra avvolgerlo."]
    }
};

// ── SHOP DB ─────────────────────────────────────────────────
const SHOP_DB = {
    armi: [
        {id:'sh_w1',  nome:'Coltello da Caccia',    rar:'normal',  prezzo:8,   cat:'armi',     slot:'Arma',    comb:{att:1,dan:2},   res:{}, desc:'Lama corta da cintura.'},
        {id:'sh_w2',  nome:'Ascia da Boscaiolo',    rar:'normal',  prezzo:12,  cat:'armi',     slot:'Arma',    comb:{att:0,dan:3},   res:{}, desc:'Strumento e arma.'},
        {id:'sh_w3',  nome:'Spada di Ferro Grezzo', rar:'normal',  prezzo:20,  cat:'armi',     slot:'Arma',    comb:{att:1,dan:3,def:0},res:{}, desc:'Fattura cimmera grezza.'},
        {id:'sh_w4',  nome:'Scudo Rotondo Legno',   rar:'normal',  prezzo:10,  cat:'armi',     slot:'Scudo',   comb:{def:1},         res:{}, desc:'Legno con bordo di ferro.'},
        {id:'sh_w5',  nome:'Pelli di Lupo',         rar:'normal',  prezzo:15,  cat:'armi',     slot:'Torso',   comb:{rd:1,ini:-1},   res:{freddo:1}, desc:'Pelli delle steppe.'},
        {id:'sh_w6',  nome:'Cuoio di Aquilonia',    rar:'normal',  prezzo:25,  cat:'armi',     slot:'Torso',   comb:{rd:2,ini:-1},   res:{}, desc:'Armatura di cuoio indurito.'},
        {id:'sh_w7',  nome:'Elmo di Ferro',         rar:'normal',  prezzo:18,  cat:'armi',     slot:'Testa',   comb:{def:1},         res:{}, desc:'Elmetto solido.'},
        {id:'sh_w8',  nome:'Spada di Akbitana',     rar:'special', prezzo:80,  cat:'armi',     slot:'Arma',    comb:{att:2,dan:5,def:1},res:{}, desc:'Forgiata dai mastri di Akbitana.'},
        {id:'sh_w9',  nome:'Seta Nera Stigiana',    rar:'special', prezzo:95,  cat:'armi',     slot:'Torso',   comb:{rd:2,ini:1},    res:{magia:2}, desc:'Fili impregnati di magia.'},
        {id:'sh_w10', nome:'Scudo Rinforzato',      rar:'special', prezzo:60,  cat:'armi',     slot:'Scudo',   comb:{def:2,att:-1},  res:{}, desc:'Ferro e legno combinati.'},
        {id:'sh_w11', nome:'Ascia dei Nordheim',    rar:'special', prezzo:70,  cat:'armi',     slot:'Arma2M',  comb:{att:1,dan:6},   res:{freddo:1}, desc:'Incisa con rune di Ymir.'},
        {id:'sh_w12', nome:'Cotta Maglia Nordica',  rar:'rare',    prezzo:200, cat:'armi',     slot:'Torso',   comb:{rd:6,ini:-2},   res:{freddo:2}, attr:{RES:1}, desc:'Rinforzata con ossa di drago.'},
        {id:'sh_w13', nome:'Daga Culto Set',        rar:'rare',    prezzo:180, cat:'armi',     slot:'Arma',    comb:{att:3,dan:4,def:2}, elemDan:{veleno:2}, attr:{INT:1}, desc:'Avvelenata.'}
    ],
    pozioni: [
        {id:'pot1', nome:'Pozione di Guarigione',   rar:'normal',  prezzo:20,  cat:'pozioni',  uso:'hp',   effVal:15, res:{}, desc:'Recupera 15 HP.'},
        {id:'pot2', nome:'Intruglio del Vecchio',   rar:'normal',  prezzo:12,  cat:'pozioni',  uso:'hp',   effVal:8,  res:{}, desc:'Recupera 8 HP.'},
        {id:'pot3', nome:'Balsamo di Guerriero',    rar:'special', prezzo:50,  cat:'pozioni',  uso:'hp',   effVal:30, res:{}, desc:'Recupera 30 HP.'},
        {id:'pot4', nome:'Antidoto di Tigre Nera',  rar:'normal',  prezzo:25,  cat:'pozioni',  uso:'res',              res:{veleno:4}, desc:'Cura veleno persistente. +4 Rid. Veleno.'},
        {id:'pot5', nome:'Olio del Fuoco Eterno',   rar:'special', prezzo:55,  cat:'pozioni',  uso:'res',              res:{fuoco:5},  desc:'+5 Rid. Fuoco.'},
        {id:'pot6', nome:'Acqua Ghiaccio Sacro',    rar:'special', prezzo:50,  cat:'pozioni',  uso:'res',              res:{freddo:5}, desc:'+5 Rid. Freddo.'},
        {id:'pot7', nome:'Filtro Antimagico',       rar:'rare',    prezzo:120, cat:'pozioni',  uso:'res',              res:{magia:7},  desc:'+7 Rid. Magia.'},
        {id:'pot8', nome:'Elisir del Berserker',    rar:'rare',    prezzo:150, cat:'pozioni',  uso:'hp',   effVal:50, res:{}, desc:'Recupera 50 HP.'}
    ],
    pergamene: [
        {id:'perg1', nome:'Mappa delle Rovine',         rar:'normal',  prezzo:30,  cat:'pergamene', uso:'misc',  desc:'Indica una rovina inesplorata.'},
        {id:'perg2', nome:'Testo di Tattica Militare',  rar:'normal',  prezzo:25,  cat:'pergamene', uso:'comb',  comb:{att:1}, desc:'+1 ATT permanente.'},
        {id:'perg3', nome:'Pergamena di Guarigione',    rar:'special', prezzo:65,  cat:'pergamene', uso:'hp',    effVal:20, res:{}, desc:'Recupera 20 HP.'},
        {id:'perg4', nome:'Segreti di Erboristeria',    rar:'normal',  prezzo:20,  cat:'pergamene', uso:'res',              res:{veleno:2}, desc:'+2 Rid. Veleno.'},
        {id:'perg5', nome:'Rune di Protezione',         rar:'special', prezzo:80,  cat:'pergamene', uso:'res',              res:{magia:3}, desc:'+3 Rid. Magia.'},
        {id:'perg6', nome:'Codice Ladri Shadizar',      rar:'rare',    prezzo:150, cat:'pergamene', uso:'comb',  comb:{ini:2,att:1}, desc:'+2 INI +1 ATT permanenti.'}
    ],
    oggetti: [
        {id:'obj1', nome:'Torcia',                    rar:'normal',  prezzo:2,   cat:'oggetti', uso:'misc', res:{}, desc:'Illumina l\'oscurita\'.'},
        {id:'obj2', nome:'Corda (10m)',                rar:'normal',  prezzo:5,   cat:'oggetti', uso:'misc', res:{}, desc:'Utile per scalate.'},
        {id:'obj3', nome:'Razione da Viaggio',         rar:'normal',  prezzo:5,   cat:'oggetti', uso:'hp',   effVal:5, res:{}, desc:'Recupera 5 HP.'},
        {id:'obj4', nome:'Kit del Medico',             rar:'normal',  prezzo:15,  cat:'oggetti', uso:'hp',   effVal:10, res:{}, desc:'Bende ed erbe. Recupera 10 HP.'},
        {id:'obj5', nome:'Amuleto Portafortuna',       rar:'normal',  prezzo:10,  cat:'oggetti', uso:'misc', desc:'I Cimmeri giurano che porti fortuna.'},
        {id:'obj7', nome:'Amuleto Protezione',         rar:'special', prezzo:60,  cat:'oggetti', uso:'res',  res:{magia:2,veleno:2}, desc:'+2 Rid Magia e Veleno.'},
        {id:'obj8', nome:'Maschera Guerriero',         rar:'special', prezzo:75,  cat:'oggetti', uso:'comb', comb:{att:1}, desc:'+1 ATT psicologico.'}
    ]
};

// ── STATO GLOBALE ────────────────────────────────────────────
const STAT_KEYS = ['FOR','DES','COS','RES','INT','FRT'];
let pbState = {};
STAT_KEYS.forEach(k => pbState[k] = { base:9, prim:0, sec:0 });

let equippedItems = { elmo:null, armatura:null, bracciali:null, cintura:null, anello:null, stivali:null, amuleto:null, arma:null, scudo:null };
let bagItems = [];
let selectedShopItem = null;
let selectedBagItem  = null;
let selectedBagIdx   = -1;
let selectedRarity   = 'normal';
let selectedSlotRandom = 'any';
let selectedSlotScegli = 'any';
let rarFilterActive  = {normal:true,special:true,rare:true,legend:true,unique:true};
let currentForgedItem = null;
let currentChosenItem = null;

// ── UTILITY ──────────────────────────────────────────────────
function getVal(obj, key) { return (obj && obj[key] !== undefined) ? obj[key] : 0; }
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
function getSafeObj(obj) { return (obj && obj.skills) ? obj.skills : {abilita:[],competenze:[]}; }
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function rarLabel(r) { return {normal:"Normale",special:"Speciale",rare:"Raro",legend:"Leggenda",unique:"Unico"}[r] || r; }
function rarColor(r) { return {normal:"var(--col-normal)",special:"var(--col-special)",rare:"var(--col-rare)",legend:"var(--col-legend)",unique:"var(--col-unique)"}[r] || "#fff"; }

function generateTooltip(item) {
    if (!item || typeof item === 'string') return "";
    let lines = [];
    if (item.attr && Object.keys(item.attr).length > 0)
        lines.push("ATT: " + Object.entries(item.attr).map(([k,v]) => `${k} ${v>0?'+':''}${v}`).join(', '));
    if (item.comb && Object.keys(item.comb).length > 0)
        lines.push("CMB: " + Object.entries(item.comb).map(([k,v]) => `${k.toUpperCase()} ${v>0?'+':''}${v}`).join(', '));
    if (item.elemDan && Object.keys(item.elemDan).length > 0)
        lines.push("DANNO ELEM: " + Object.entries(item.elemDan).map(([k,v]) => `${k} +${v}`).join(', '));
    if (item.res && Object.keys(item.res).length > 0)
        lines.push("RID. ELEM: " + Object.entries(item.res).map(([k,v]) => `${k} +${v}`).join(', '));
    if (item.skills) {
        if (item.skills.abilita && item.skills.abilita.length > 0) lines.push("ABILITA': " + item.skills.abilita.join(', '));
        if (item.skills.competenze && item.skills.competenze.length > 0) lines.push("COMPETENZE: " + item.skills.competenze.join(', '));
    }
    if (item.tratto) lines.push("TRATTO: " + item.tratto);
    if (item.bonus) lines.push("DONO: " + item.bonus);
    return lines.length > 0 ? lines.join('\n') : "Nessun effetto diretto.";
}

function popSelect(id, data) {
    const sel = document.getElementById(id);
    if (!sel || !data) return;
    sel.innerHTML = '';
    Object.keys(data).forEach(key => {
        let item = data[key];
        let opt = document.createElement('option');
        opt.value = key;
        if (typeof item === 'string') { opt.textContent = item; }
        else { opt.textContent = item.nome || "Sconosciuto"; opt.title = generateTooltip(item); }
        sel.appendChild(opt);
    });
}

function updateNames() {
    const selSesso = document.getElementById('sel-sesso');
    const selNome  = document.getElementById('sel-nome');
    if (!selSesso || !selNome) return;
    const key = selSesso.value; // 'maschi' or 'femmine'
    const names = DB.nomi[key] || DB.nomi.maschi;
    selNome.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
    calcAll(); // recalc stats with gender modifier
}

function aggiornaSottoclasse() {
    const ck = document.getElementById('sel-classe');
    if (!ck) return;
    const classeData = DB.classi[ck.value];
    if (classeData) popSelect('sel-sottoclasse', classeData.sottoclassi);
    calcAll();
}

// ── POINT BUY ────────────────────────────────────────────────
// Pool primario: 6 punti (max +3 per caratteristica)
// Pool scambio: generato abbassando la base (6-9, max -3 per stat, totale max -6)
// Punti scambio redistribuibili: max +2 per caratteristica

function buildAttrUI() {
    const container = document.getElementById('attr-grid-container');
    if (!container) return;
    container.innerHTML = '';
    STAT_KEYS.forEach(k => {
        container.innerHTML += `
        <div class="cs-attr-box">
            <div class="cs-attr-left">
                <span class="cs-attr-name">${k}</span>
                <div class="cs-attr-controls">
                    <span style="font-size:0.7em;color:#888;">Base(6-9):</span>
                    <button id="btn-base-dwn-${k}" onclick="updatePB('${k}','base',-1)">-</button>
                    <span id="val-base-${k}">9</span>
                    <button id="btn-base-up-${k}" onclick="updatePB('${k}','base',1)">+</button>
                    &nbsp;<span style="font-size:0.7em;color:#888;">(+3):</span>
                    <button id="btn-prim-dwn-${k}" onclick="updatePB('${k}','prim',-1)">-</button>
                    <span id="val-prim-${k}">0</span>
                    <button id="btn-prim-up-${k}" onclick="updatePB('${k}','prim',1)">+</button>
                    &nbsp;<span style="font-size:0.7em;color:#888;">(+2):</span>
                    <button id="btn-sec-dwn-${k}" onclick="updatePB('${k}','sec',-1)">-</button>
                    <span id="val-sec-${k}">0</span>
                    <button id="btn-sec-up-${k}" onclick="updatePB('${k}','sec',1)">+</button>
                </div>
            </div>
            <div class="cs-attr-right">
                <div class="cs-attr-mod" id="mod-${k.toLowerCase()}">+0</div>
                <div class="cs-attr-total" id="tot-${k.toLowerCase()}">9</div>
            </div>
        </div>`;
    });
}

function updatePB(stat, type, delta) {
    let s = pbState[stat];
    // Calculate current total reduction before change
    let totalReduction = 0;
    STAT_KEYS.forEach(k => { totalReduction += (9 - pbState[k].base); });

    if (type === 'base') {
        // Lowering base (delta = -1): check max reduction
        if (delta < 0 && totalReduction >= 6) return;
        s.base = clamp(s.base + delta, 6, 9);
    } else if (type === 'prim') {
        s.prim = clamp(s.prim + delta, 0, 3);
    } else if (type === 'sec') {
        s.sec = clamp(s.sec + delta, 0, 2);
    }
    document.getElementById(`val-base-${stat}`).textContent = s.base;
    document.getElementById(`val-prim-${stat}`).textContent = (s.prim > 0 ? '+' : '') + s.prim;
    document.getElementById(`val-sec-${stat}`).textContent = (s.sec > 0 ? '+' : '') + s.sec;
    aggiornaPoolUI();
    calcAll();
}

function aggiornaPoolUI() {
    let primUsed = 0, secGained = 0, secUsed = 0;
    STAT_KEYS.forEach(k => {
        primUsed += pbState[k].prim;
        secGained += (9 - pbState[k].base);
        secUsed += pbState[k].sec;
    });
    let primAvail = 6 - primUsed;
    let secAvail  = secGained - secUsed;
    const pdEl = document.getElementById('pool-prim-display');
    const sdEl = document.getElementById('pool-sec-display');
    if (pdEl) pdEl.textContent = primAvail;
    if (sdEl) sdEl.textContent = secAvail;
    STAT_KEYS.forEach(k => {
        const s = pbState[k];
        const pUp  = document.getElementById(`btn-prim-up-${k}`);
        const pDwn = document.getElementById(`btn-prim-dwn-${k}`);
        const sUp  = document.getElementById(`btn-sec-up-${k}`);
        const sDwn = document.getElementById(`btn-sec-dwn-${k}`);
        const bUp  = document.getElementById(`btn-base-up-${k}`);
        const bDwn = document.getElementById(`btn-base-dwn-${k}`);
        if (pUp)  pUp.disabled  = (primAvail <= 0 || s.prim >= 3);
        if (pDwn) pDwn.disabled = (s.prim <= 0);
        if (sUp)  sUp.disabled  = (secAvail <= 0 || s.sec >= 2);
        if (sDwn) sDwn.disabled = (s.sec <= 0);
        if (bUp)  bUp.disabled  = (s.base >= 9);
        if (bDwn) bDwn.disabled = (s.base <= 6 || secGained >= 6);
    });
}

// ── CALCOLO PRINCIPALE ───────────────────────────────────────
function calcAll() {
    const razza     = DB.razze[document.getElementById('sel-razza')?.value]     || {};
    const classeKey = document.getElementById('sel-classe')?.value;
    const scKey     = document.getElementById('sel-sottoclasse')?.value;
    const classeData= (DB.classi[classeKey] && DB.classi[classeKey].sottoclassi[scKey]) || {};
    const bg        = DB.background[document.getElementById('sel-bg')?.value]   || {};
    const dio       = DB.dei[document.getElementById('sel-dio')?.value]         || {};
    const evento    = DB.eventi[document.getElementById('sel-evento')?.value]   || {};
    const condotta  = DB.condotte[document.getElementById('sel-condotta')?.value]|| {};
    const eta       = DB.eta[document.getElementById('sel-eta')?.value]         || {};

    // Aggiorna zecchini iniziali
    const zecEl = document.getElementById('val-zecchini');
    if (zecEl && zecEl.value === "1" && getVal(bg, 'zecchini') > 0) {
        zecEl.value = 1 + getVal(bg, 'zecchini');
    }
    const fateEl = document.getElementById('val-fate');
    if (fateEl) fateEl.value = getVal(evento, 'fate');

    // Bonus da equipaggiamento
    let eqAttr = {FOR:0,DES:0,COS:0,RES:0,INT:0,FRT:0};
    let eqComb = {att:0,dan:0,def:0,rd:0,ini:0};
    let eqRes  = {fuoco:0,freddo:0,acido:0,veleno:0,magia:0,fulmine:0,incanto:0};
    Object.values(equippedItems).forEach(item => {
        if (!item) return;
        if (item.attr) Object.entries(item.attr).forEach(([k,v]) => { if (eqAttr[k] !== undefined) eqAttr[k] += v; });
        if (item.comb) Object.entries(item.comb).forEach(([k,v]) => { if (eqComb[k] !== undefined) eqComb[k] += v; });
        if (item.res)  Object.entries(item.res).forEach(([k,v])  => { if (eqRes[k] !== undefined)  eqRes[k]  += v; });
    });

    // Gender modifier: femmina = FOR-1, DES+1
    const sesso = document.getElementById('sel-sesso')?.value;
    const sessoMods = (sesso === 'femmine') ? { FOR: -1, DES: 1, RES: 1, COS: -1, INT: 1, FRT: -1 } : {};

    // Calcola attributi totali
    let mods = {}, T = {};
    STAT_KEYS.forEach(stat => {
        mods[stat] = getVal(razza.attr, stat) + getVal(classeData.attr, stat) + getVal(bg.attr, stat)
                   + getVal(dio.attr, stat) + getVal(evento.attr, stat) + getVal(condotta.attr, stat)
                   + getVal(eta.attr, stat) + eqAttr[stat] + getVal(sessoMods, stat);
        const modEl = document.getElementById(`mod-${stat.toLowerCase()}`);
        if (modEl) modEl.textContent = (mods[stat] >= 0 ? '+' : '') + mods[stat];
        T[stat] = clamp(pbState[stat].base + pbState[stat].prim + pbState[stat].sec + mods[stat], 0, 18);
        const totEl = document.getElementById(`tot-${stat.toLowerCase()}`);
        if (totEl) totEl.textContent = T[stat];
    });

    // Threshold mastery bonus: >=15→+1, >=18→+2, >=21→+3
    const thrBonus = v => v >= 21 ? 3 : v >= 18 ? 2 : v >= 15 ? 1 : 0;
    const Te = {}; // effective T with threshold bonus
    STAT_KEYS.forEach(s => { Te[s] = T[s] + thrBonus(T[s]); });

    // Combattimento base — ATT←FOR, DAN←INT, DEF←DES, RD←RES, INI←FRT, HP←COS
    let combFix = {att:0, dan:0, def:0, ini:0, rd:0};
    for (let k in combFix) combFix[k] = getVal(classeData.comb, k) + getVal(dio.comb, k) + getVal(condotta.comb, k);

    const baseAtt = combFix.att + Math.floor(Te.FOR / 3);
    const baseDan = combFix.dan + Math.floor(Te.INT / 3);
    const baseDef = combFix.def + Math.floor(Te.DES / 4);
    const baseIni = combFix.ini + Math.floor(Te.FRT / 2);
    const baseRd  = combFix.rd  + Math.floor(Te.RES / 5);
    const baseHp  = getVal(classeData, 'hp') + getVal(bg, 'hp') + getVal(dio, 'hp') + (Te.COS * 2);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('val-hp', baseHp);
    set('val-energia', (T.INT + T.FRT) * 2);

    function showStat(id, base, eq, deltaId) {
        set(id, base + eq);
        const del = document.getElementById(deltaId);
        if (del) {
            if (eq !== 0) { del.textContent = (eq > 0 ? '+' : '') + eq + '(eq)'; del.className = 'comb-delta ' + (eq > 0 ? 'pos' : 'neg'); }
            else { del.textContent = ''; del.className = 'comb-delta'; }
        }
    }
    showStat('val-att', baseAtt, eqComb.att, 'delta-att');
    showStat('val-dan', baseDan, eqComb.dan, 'delta-dan');
    showStat('val-def', baseDef, eqComb.def, 'delta-def');
    showStat('val-ini', baseIni, eqComb.ini, 'delta-ini');
    showStat('val-rd',  baseRd,  eqComb.rd,  'delta-rd');

    // Resistenze flat
    ['fuoco','freddo','acido','veleno','magia','fulmine'].forEach(type => {
        const val = getVal(razza.res, type) + getVal(dio.res, type) + getVal(evento.res, type)
                  + getVal(condotta.res, type) + Math.floor(T.RES / 5) + eqRes[type];
        set(`res-${type}`, clamp(val, 0, 100));
    });
    const incanto = Math.floor(T.FRT / 2) + Math.floor(T.RES / 5) + getVal(condotta.res, 'incanto') + eqRes.incanto;
    set('res-incanto', clamp(incanto, 0, 100));

    // Abilita' e Competenze
    const s1=getSafeObj(razza), s2=getSafeObj(classeData), s3=getSafeObj(bg),
          s4=getSafeObj(dio),   s5=getSafeObj(evento),      s6=getSafeObj(condotta);
    const allAbilita  = new Set([...s1.abilita, ...s2.abilita, ...s3.abilita, ...s4.abilita, ...s5.abilita, ...s6.abilita]);
    const allCompetenze = new Set([...s1.competenze, ...s2.competenze, ...s3.competenze, ...s4.competenze, ...s5.competenze, ...s6.competenze]);
    const SKILL_TIPS = {
        'Furia': 'In combattimento: prossimo attacco DAN×2',
        'Intimidire': 'In combattimento: nemico ATT-2 DEF-2 turno prossimo',
        'Sopravvivenza': 'In combattimento: DEF+4 turno prossimo',
        'Sopportazione': 'In combattimento: RD+5 turno prossimo',
        'Resistenza': 'Bonus passivo alla resistenza ai danni',
        'Furtività': 'Bonus nelle azioni di stealth',
        "Furtivita'": 'Bonus nelle azioni di stealth',
        'Scassinare': 'Apre serrature e meccanismi',
        'Inganno': 'Bonus nelle trattative e inganni',
        'Leadership': 'Bonus al morale delle truppe alleate',
        'Combattimento': 'In combattimento: danno extra +3',
        'Acrobazia': 'Bonus alle azioni acrobatiche',
        "Mirabilita'": 'Colpi di precisione con arco',
        'Occultismo': 'Conoscenza di riti e magie oscure',
        'Benedizione': 'In combattimento: recupero immediato +8 HP',
        'Guarigione': 'In combattimento: recupero immediato +12 HP',
        'Schivata': 'In combattimento: +50% chance schivata',
        'Maledizione': 'In combattimento: nemico ATT-3 turno prossimo',
        'Evocazioni': 'In combattimento: danno extra magico +4',
    };
    const skillsEl = document.getElementById('skills-container');
    if (skillsEl) {
        const mkTag = (s) => `<span class="skill-tag" title="${SKILL_TIPS[s] || s}">${s}</span>`;
        skillsEl.innerHTML = `
            <div class="skill-section"><strong>Abilita':</strong><br>${[...allAbilita].map(mkTag).join('')}</div>
            <div class="skill-section" style="margin-top:6px;"><strong>Competenze:</strong><br>${[...allCompetenze].map(mkTag).join('')}</div>`;
    }

    // Tratti
    const tratti = [razza.tratto, dio.bonus].filter(Boolean);
    const traitBox  = document.getElementById('trait-box');
    const traitText = document.getElementById('trait-text');
    if (traitBox && traitText) {
        if (tratti.length > 0) {
            traitBox.style.display = 'block';
            traitText.innerHTML = tratti.join('<br>');
        } else {
            traitBox.style.display = 'none';
        }
    }

    // Tratti attivi dalla classe
    const tratiAttiviEl = document.getElementById('trait-attivi-text');
    const tratiAttiviBox = document.getElementById('trait-attivi-box');
    if (tratiAttiviEl && tratiAttiviBox) {
        const attiviList = [];
        if (classeData && classeData.comb) {
            const combStr = Object.entries(classeData.comb).map(([k,v])=>`${k.toUpperCase()} ${v>0?'+':''}${v}`).join(', ');
            if (combStr) attiviList.push(`Bonus Classe: ${combStr}`);
        }
        if (bg.zecchini) attiviList.push(`Oro Iniziale: ${bg.zecchini} zecchini`);
        if (attiviList.length > 0) {
            tratiAttiviBox.style.display = 'block';
            tratiAttiviEl.innerHTML = attiviList.join('<br>');
        } else {
            tratiAttiviBox.style.display = 'none';
        }
    }
}

// ── INVENTARIO ATTIVO ─────────────────────────────────────────
function slotForItem(item) {
    if (!item) return null;
    const map = {Testa:'elmo',Collo:'amuleto',Bracciali:'bracciali',Cintura:'cintura',
                 AnelloDX:'anello',Stivali:'stivali',Torso:'armatura',Scudo:'scudo',
                 Arma:'arma',Arma2M:'arma',Arco:'arma'};
    return map[item.slot] || null;
}

function equipItem(item) {
    if (!item) return;
    const slot = slotForItem(item);
    if (!slot) return;
    equippedItems[slot] = item;
    refreshInventoryUI();
    calcAll();
}

function removeEquip(slot) {
    equippedItems[slot] = null;
    refreshInventoryUI();
    calcAll();
}

function refreshInventoryUI() {
    Object.entries(equippedItems).forEach(([slot, item]) => {
        const nameEl  = document.getElementById('inv-name-' + slot);
        const bonusEl = document.getElementById('inv-bonus-' + slot);
        if (!nameEl) return;
        nameEl.className = 'inv-item-name ' + (item ? 'rar-' + item.rar : 'rar-normal');
        nameEl.textContent = item ? item.nome : '--- Vuoto ---';
        if (bonusEl) {
            if (item) {
                const parts = [];
                if (item.attr) Object.entries(item.attr).forEach(([k,v]) => parts.push(`${k}${v>0?'+':''}${v}`));
                if (item.comb) Object.entries(item.comb).forEach(([k,v]) => parts.push(`${k.toUpperCase()}${v>0?'+':''}${v}`));
                if (item.res)  Object.entries(item.res).forEach(([k,v])  => parts.push(`Rid.${k.charAt(0).toUpperCase()+k.slice(1)} +${v}`));
                if (item.elemDan) Object.entries(item.elemDan).forEach(([k,v]) => parts.push(`Danno ${k.charAt(0).toUpperCase()+k.slice(1)} +${v}`));
                bonusEl.textContent = parts.join(' | ');
                bonusEl.style.color = rarColor(item.rar);
            } else { bonusEl.textContent = ''; }
        }
    });
}

// ── NEGOZIO ──────────────────────────────────────────────────
function showShopMsg(msg, ok) {
    const el = document.getElementById('shop-msg');
    if (!el) return;
    el.textContent = msg; el.className = 'shop-msg ' + (ok ? 'ok' : 'err');
    setTimeout(() => { el.textContent = ''; el.className = 'shop-msg'; }, 3000);
}

function renderShopGrid(cat, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const items = SHOP_DB[cat] || [];
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shop-card rar-' + item.rar;
        const priceStr = item.prezzo > 0 ? item.prezzo + ' Zecchini' : '<span style="color:#888">Solo Quest</span>';
        const effParts = [];
        if (item.effVal && item.uso === 'hp') effParts.push('+' + item.effVal + ' HP');
        if (item.res) Object.entries(item.res).forEach(([k,v]) => { if (v) effParts.push('Rid.' + k + ' +' + v); });
        if (item.attr) Object.entries(item.attr).forEach(([k,v]) => { if (v) effParts.push(k + (v>0?'+':'') + v); });
        if (item.comb) Object.entries(item.comb).forEach(([k,v]) => { if (v) effParts.push(k.toUpperCase() + (v>0?'+':'') + v); });
        div.innerHTML = `
            <div class="sc-name">${item.nome}</div>
            <div class="sc-price">${priceStr}</div>
            <div class="sc-desc">${item.desc}</div>
            ${effParts.length ? '<div class="sc-effect">' + effParts.join(' | ') + '</div>' : ''}`;
        if (item.prezzo > 0) { div.onclick = () => selectShopItem(item); }
        else { div.style.opacity = '0.5'; div.style.cursor = 'default'; }
        container.appendChild(div);
    });
}

function selectShopItem(item) {
    selectedShopItem = item;
    const bar = document.getElementById('shop-buy-bar');
    if (bar) bar.style.display = 'block';
    const nameEl = document.getElementById('shop-buy-name');
    if (nameEl) nameEl.textContent = '[' + rarLabel(item.rar) + '] ' + item.nome;
    const descEl = document.getElementById('shop-buy-desc');
    if (descEl) descEl.textContent = item.desc;
}

function buySelectedItem() {
    if (!selectedShopItem) return;
    const zecEl = document.getElementById('val-zecchini');
    let z = parseInt(zecEl ? zecEl.value : 0) || 0;
    if (z < selectedShopItem.prezzo) { showShopMsg('Zecchini insufficienti!', false); return; }
    if (zecEl) zecEl.value = z - selectedShopItem.prezzo;
    bagItems.push({...selectedShopItem, uses: (selectedShopItem.uso === 'hp' || selectedShopItem.uso === 'res') ? 1 : 99});
    renderBag();
    showShopMsg('Acquistato: ' + selectedShopItem.nome, true);
    const bar = document.getElementById('shop-buy-bar');
    if (bar) bar.style.display = 'none';
    selectedShopItem = null;
}

function renderBag() {
    const container = document.getElementById('inv-bag-display');
    if (!container) return;
    if (bagItems.length === 0) { container.innerHTML = '<span style="color:#555;font-style:italic;font-size:0.8em;">Zaino vuoto</span>'; return; }
    container.innerHTML = '';
    bagItems.forEach((item, idx) => {
        const div = document.createElement('span');
        div.className = 'inv-bag-item rar-' + item.rar;
        div.textContent = item.nome + (item.uses && item.uses < 99 ? ' (x' + item.uses + ')' : '');
        div.onclick = () => selectBagItem(item, idx);
        container.appendChild(div);
    });
}

function selectBagItem(item, idx) {
    selectedBagItem = item; selectedBagIdx = idx;
    const bar = document.getElementById('bag-detail-bar');
    if (bar) bar.style.display = 'block';
    const nameEl = document.getElementById('bag-detail-name');
    const descEl = document.getElementById('bag-detail-desc');
    if (nameEl) nameEl.textContent = item.nome;
    if (descEl) descEl.textContent = item.desc;
}

function useBagItem() {
    if (!selectedBagItem || selectedBagIdx < 0) return;
    const item = selectedBagItem;
    if (item.uso === 'hp' && item.effVal) {
        const hpEl = document.getElementById('val-hp');
        if (hpEl) hpEl.textContent = (parseInt(hpEl.textContent) || 0) + item.effVal;
        showShopMsg('+' + item.effVal + ' HP Recuperati!', true);
        consumeBagItem();
    } else if (item.uso === 'res') {
        Object.keys(item.res || {}).forEach(k => {
            const el = document.getElementById('res-' + k);
            if (el) el.textContent = (parseInt(el.textContent) || 0) + item.res[k];
        });
        showShopMsg('Resistenze aumentate!', true);
        consumeBagItem();
    } else if (item.slot) {
        equipItem(item);
        showShopMsg(item.nome + ' equipaggiato!', true);
        bagItems.splice(selectedBagIdx, 1);
        renderBag(); hideBagDetail();
    } else if (item.uso === 'comb') {
        Object.entries(item.comb || {}).forEach(([k,v]) => {
            const el = document.getElementById('val-' + k);
            if (el) el.textContent = (parseInt(el.textContent) || 0) + v;
        });
        showShopMsg('Conoscenza assimilata!', true);
        consumeBagItem();
    } else {
        showShopMsg('Oggetto usato.', true);
        consumeBagItem();
    }
}

function consumeBagItem() {
    if (selectedBagIdx < 0) return;
    if (bagItems[selectedBagIdx] && bagItems[selectedBagIdx].uses > 1) { bagItems[selectedBagIdx].uses--; }
    else { bagItems.splice(selectedBagIdx, 1); }
    renderBag(); hideBagDetail();
}

function dropBagItem() {
    if (selectedBagIdx < 0) return;
    bagItems.splice(selectedBagIdx, 1);
    renderBag(); hideBagDetail();
    showShopMsg('Oggetto gettato.', false);
}

function hideBagDetail() {
    const bar = document.getElementById('bag-detail-bar');
    if (bar) bar.style.display = 'none';
    selectedBagItem = null; selectedBagIdx = -1;
}

function switchShop(tab) {
    document.querySelectorAll('.shop-tab').forEach((t, i) =>
        t.classList.toggle('active', ['armi','pozioni','pergamene','oggetti'][i] === tab));
    document.querySelectorAll('.shop-section').forEach((s, i) =>
        s.classList.toggle('active', ['ss-armi','ss-pozioni','ss-pergamene','ss-oggetti'][i] === 'ss-' + tab));
    const bar = document.getElementById('shop-buy-bar');
    if (bar) bar.style.display = 'none';
}

// ── MAPPA ────────────────────────────────────────────────────
const CS_MAP_LOCATIONS = [
    {name:"Venarium",  x:22,y:18,type:"quest",   desc:"Antica fortezza di confine."},
    {name:"Tarantia",  x:42,y:55,type:"capital",  desc:"Splendida capitale dell'Aquilonia."},
    {name:"Shadizar",  x:62,y:60,type:"city",     desc:"La famigerata Citta' dei Ladri."},
    {name:"Khorshemish",x:58,y:72,type:"city",    desc:"Grande citta' mercantile di Shem."},
    {name:"Messantia", x:30,y:75,type:"city",     desc:"Porto principale di Argos."},
    {name:"Zuarir",    x:72,y:80,type:"city",     desc:"Oasi fortificata."},
    {name:"Koppar",    x:18,y:40,type:"city",     desc:"Citta' mineraria."},
    {name:"Thanza",    x:35,y:30,type:"village",  desc:"Antico insediamento collinare."},
    {name:"Asgalun",   x:55,y:85,type:"city",     desc:"Potente citta'-stato di Shem."},
    {name:"Koth",      x:50,y:62,type:"city",     desc:"Terra di mercenari."},
    {name:"Conajohara",x:28,y:22,type:"quest",    desc:"Avamposto di frontiera."},
    {name:"Gurth",     x:14,y:28,type:"village",  desc:"Villaggio montano cimmero."},
    {name:"Ormuz",     x:78,y:55,type:"city",     desc:"Citta' di armi incantate."},
    {name:"Tyro",      x:40,y:88,type:"city",     desc:"Citta' di missioni e taverne."},
    {name:"Arya",      x:65,y:35,type:"village",  desc:"Contrada commerciale."}
];

const CS_MAP_ROUTES = [
    [0,10],[10,6],[6,7],[7,1],[1,3],[3,9],[9,2],[2,11],[11,0],
    [1,4],[4,13],[13,3],[3,8],[8,5],[5,2],[9,12],[12,5],[7,0]
];

function buildMap() {
    const container = document.getElementById('map-container');
    const svg = document.getElementById('map-svg');
    if (!container || !svg) return;
    const W = container.offsetWidth || 900;
    const H = container.offsetHeight || 320;
    let svgContent = '';
    CS_MAP_ROUTES.forEach(([a, b]) => {
        const la = CS_MAP_LOCATIONS[a], lb = CS_MAP_LOCATIONS[b];
        const x1 = (la.x/100)*W, y1 = (la.y/100)*H;
        const x2 = (lb.x/100)*W, y2 = (lb.y/100)*H;
        svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(90,70,30,0.45)" stroke-width="1" stroke-dasharray="4,3"/>`;
    });
    svg.innerHTML = svgContent;
    container.querySelectorAll('.map-location').forEach(e => e.remove());
    CS_MAP_LOCATIONS.forEach(loc => {
        const div = document.createElement('div');
        div.className = 'map-location';
        div.style.left = loc.x + '%'; div.style.top = loc.y + '%';
        div.title = loc.name + ': ' + loc.desc;
        div.innerHTML = `<div class="map-dot ${loc.type}"></div><div class="map-label">${loc.name}</div>`;
        container.appendChild(div);
    });
}

// ── FORGIA CASUALE ───────────────────────────────────────────
function selectRarity(rar, btn) {
    selectedRarity = rar;
    document.querySelectorAll('#rarity-bar .rarity-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

function selectSlot(slot, btn, section) {
    if (section === 'random') {
        selectedSlotRandom = slot;
        document.querySelectorAll('#slot-filter-random .slot-btn').forEach(b => b.classList.remove('active'));
    } else {
        selectedSlotScegli = slot;
        document.querySelectorAll('#slot-filter-scegli .slot-btn').forEach(b => b.classList.remove('active'));
        renderItemList();
    }
    btn.classList.add('active');
}

function toggleRarFilter(rar, btn) {
    rarFilterActive[rar] = !rarFilterActive[rar];
    btn.classList.toggle('selected');
    renderItemList();
}

function forgiaCasuale() {
    const allSlots = Object.keys(FORGIA_GEN.bases);
    const slot = selectedSlotRandom === 'any' ? rnd(allSlots) : selectedSlotRandom;
    const base = rnd(FORGIA_GEN.bases[slot]);
    const adjKey = rnd(Object.keys(FORGIA_GEN.adj));
    const adj = FORGIA_GEN.adj[adjKey];
    const adjForm = adj[base.g + (base.s === 's' ? 's' : 'p')];
    const itemName = `${base.n} ${adjForm} ${rnd(FORGIA_GEN.suffixes)}`;

    const rp = FORGIA_GEN.rarityPower[selectedRarity];
    const sw = FORGIA_GEN.slotWeights[slot] || {attr:1,combat:1,res:1};
    const attr = {}, comb = {}, res = {}, elemDan = {};

    if (rp.attrPts > 0) {
        let pts = rp.attrPts, pool = [...STAT_KEYS];
        while (pts > 0 && pool.length > 0) {
            const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
            if (Math.random() < sw.attr * 0.5) { attr[k] = Math.random() < 0.8 ? Math.min(pts, rp.attrMax) : -1; pts--; }
        }
    }
    if (rp.combPts > 0) {
        let pts = rp.combPts, ck = ['att','dan','def','rd','ini'];
        while (pts > 0 && ck.length > 0) {
            const k = ck.splice(Math.floor(Math.random() * ck.length), 1)[0];
            if (Math.random() < sw.combat * 0.4) { comb[k] = Math.random() < 0.85 ? Math.min(pts, rp.combMax) : -1; pts--; }
        }
    }
    if (rp.resPts > 0) {
        let pts = rp.resPts, rt = ['fuoco','freddo','acido','veleno','magia','fulmine','incanto'];
        while (pts > 0 && rt.length > 0) {
            const k = rt.splice(Math.floor(Math.random() * rt.length), 1)[0];
            if (Math.random() < sw.res * 0.4) {
                if (slot === 'Arma' || slot === 'Arma2M' || slot === 'Arco') elemDan[k] = rndInt(1, rp.resMax);
                else res[k] = rndInt(1, rp.resMax);
                pts--;
            }
        }
    }

    currentForgedItem = {
        id: 'forged_' + Date.now(), nome: itemName, rar: selectedRarity, slot,
        attr, comb, res, elemDan, lore: rnd(FORGIA_GEN.rarLore[selectedRarity])
    };
    renderItemCard(currentForgedItem, 'item-card-random');
    const btn = document.getElementById('btn-equip-random');
    if (btn) btn.disabled = false;
}

function equipCurrentItem() { if (currentForgedItem) equipItem(currentForgedItem); }
function equipChosenItem()   { if (currentChosenItem) equipItem(currentChosenItem); }

function renderItemList() {
    const container = document.getElementById('item-list-container');
    if (!container) return;
    container.innerHTML = '';
    let allItems = [];
    Object.values(FORGIA_DB).forEach(arr => allItems.push(...arr));
    allItems = allItems.filter(item => {
        if (["Nessuno","Nessuna","Vuoto"].includes(item.nome)) return false;
        if (!rarFilterActive[item.rar]) return false;
        if (selectedSlotScegli !== 'any' && item.slot !== selectedSlotScegli) return false;
        return true;
    });
    if (allItems.length === 0) { container.innerHTML = '<div style="color:#888;font-style:italic;">Nessun oggetto con i filtri attuali.</div>'; return; }
    allItems.forEach(item => {
        const div = document.createElement('div');
        div.className = `item-list-card rar-${item.rar}`;
        const sl = [];
        if (item.comb) Object.entries(item.comb).forEach(([k,v]) => sl.push(`${k.toUpperCase()}:${v>0?'+':''}${v}`));
        if (item.attr) Object.entries(item.attr).forEach(([k,v]) => sl.push(`${k}:${v>0?'+':''}${v}`));
        if (item.res) Object.entries(item.res).forEach(([k,v]) => sl.push(`Rid.${k.charAt(0)}:+${v}`));
        div.innerHTML = `<div class="ilc-name">[${rarLabel(item.rar)}] ${item.nome}</div><div class="ilc-stats">${sl.join(' | ') || '-'}</div>`;
        div.onclick = () => selectItemFromList(item, div);
        container.appendChild(div);
    });
}

function selectItemFromList(item, div) {
    document.querySelectorAll('.item-list-card').forEach(d => d.style.outline = '');
    div.style.outline = `2px solid ${rarColor(item.rar)}`;
    currentChosenItem = item;
    renderItemCard(item, 'item-card-scegli');
    const btn = document.getElementById('btn-equip-scegli');
    if (btn) btn.disabled = false;
}

function renderItemCard(item, containerId) {
    const c = document.getElementById(containerId);
    if (!item || !c) return;
    const col = rarColor(item.rar);
    let statsHtml = '';
    if (item.attr) Object.entries(item.attr).forEach(([k,v]) => { statsHtml += `<span class="item-stat-pill ${v>0?'pos':'neg'}">${k}: ${v>0?'+':''}${v}</span>`; });
    if (item.comb) Object.entries(item.comb).forEach(([k,v]) => { statsHtml += `<span class="item-stat-pill ${v>0?'pos':'neg'}">${k.toUpperCase()}: ${v>0?'+':''}${v}</span>`; });
    if (item.res) Object.entries(item.res).forEach(([k,v]) => { statsHtml += `<span class="item-stat-pill ${v>0?'pos':'neg'}">Rid. ${k}: ${v>0?'+':''}${v}</span>`; });
    if (item.elemDan) Object.entries(item.elemDan).forEach(([k,v]) => { statsHtml += `<span class="item-stat-pill pos">Danno ${k}: +${v}</span>`; });
    c.innerHTML = `
        <div class="item-card-name" style="color:${col}">${item.nome}</div>
        <div class="item-card-rarity" style="color:${col}">${rarLabel(item.rar)} &bull; Slot: ${item.slot}</div>
        <div class="item-card-stats">${statsHtml || '<span class="item-stat-pill">Nessun bonus diretto</span>'}</div>
        ${item.lore ? `<div class="item-card-lore">"${item.lore}"</div>` : ''}`;
    c.style.borderColor = col;
}

function switchForgia(tab) {
    document.querySelectorAll('.forgia-tab').forEach((t, i) =>
        t.classList.toggle('active', ['random','scegli'][i] === tab));
    document.querySelectorAll('.forgia-section').forEach((s, i) =>
        s.classList.toggle('active', ['fs-random','fs-scegli'][i] === 'fs-' + tab));
    if (tab === 'scegli') renderItemList();
}

// ── FRAMMENTI ─────────────────────────────────────────────────
const FRAMMENTI_NOMI = [
    "L'Urlo del Sangue","Il Canto dei Clan","La Sposa Serpente","Il Cuore di Fuoco",
    "Il Ghiaccio Rotto","La Zanna del Troll","L'Ombra Rubata","La Danza dei Morti",
    "Il Tradimento","La Scalata","L'Addio","L'Urlo Finale"
];
let frammentiRaccolti = [];

function renderFragmenti() {
    const grid = document.getElementById('frammenti-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        const raccolto = frammentiRaccolti.includes(i + 1);
        const div = document.createElement('div');
        div.style.cssText = `padding:6px 4px;border-radius:4px;text-align:center;font-size:0.7em;cursor:pointer;
            border:1px solid ${raccolto?'#88ccff':'#444'};
            background:${raccolto?'rgba(136,204,255,0.15)':'rgba(0,0,0,0.3)'};
            color:${raccolto?'#88ccff':'#555'};`;
        div.innerHTML = `<div style="font-size:1.4em;">${raccolto?'❄':'○'}</div><div>${i+1}</div><div style="font-size:0.85em;margin-top:2px;">${FRAMMENTI_NOMI[i].substring(0,12)}…</div>`;
        div.title = `Frammento ${i+1} – ${FRAMMENTI_NOMI[i]}${raccolto?' (RACCOLTO)':' (non ancora)'}`;
        div.onclick = () => toggleFragmento(i + 1);
        grid.appendChild(div);
    }
    const n = frammentiRaccolti.length;
    const bar = document.getElementById('frammenti-bar');
    const label = document.getElementById('frammenti-label');
    const panel = document.getElementById('frammenti-panel');
    const msg = document.getElementById('frammenti-martello-msg');
    if (bar) bar.style.width = (n / 12 * 100) + '%';
    if (label) label.textContent = n + ' / 12';
    if (panel) { const t = panel.querySelector('.panel-title'); if (t) t.textContent = `❄ Frammenti dell'Urlo di Ymir (${n} / 12)`; }
    if (msg) msg.style.display = n >= 12 ? 'block' : 'none';
}

function toggleFragmento(idx) {
    const pos = frammentiRaccolti.indexOf(idx);
    if (pos >= 0) frammentiRaccolti.splice(pos, 1);
    else frammentiRaccolti.push(idx);
    frammentiRaccolti.sort((a, b) => a - b);
    renderFragmenti();
}
function addFragmento() {
    for (let i = 1; i <= 12; i++) { if (!frammentiRaccolti.includes(i)) { frammentiRaccolti.push(i); frammentiRaccolti.sort((a,b)=>a-b); break; } }
    renderFragmenti();
}
function resetFragmenti() { frammentiRaccolti = []; renderFragmenti(); }

// ── INIT / COLLECT ───────────────────────────────────────────
function CS_init(charData) {
    // Reset state
    STAT_KEYS.forEach(k => pbState[k] = { base:9, prim:0, sec:0 });
    equippedItems = { elmo:null, armatura:null, bracciali:null, cintura:null, anello:null, stivali:null, amuleto:null, arma:null, scudo:null };
    bagItems = [];
    selectedShopItem = null; selectedBagItem = null; selectedBagIdx = -1;
    selectedRarity = 'normal'; selectedSlotRandom = 'any'; selectedSlotScegli = 'any';
    rarFilterActive = {normal:true,special:true,rare:true,legend:true,unique:true};
    currentForgedItem = null; currentChosenItem = null;
    frammentiRaccolti = [];

    // Seed
    const seedEl = document.getElementById('inp-seed');
    if (seedEl) seedEl.value = Math.floor(1000 + Math.random() * 9000);

    // Populate selects
    popSelect('sel-razza', DB.razze);
    popSelect('sel-classe', DB.classi);
    aggiornaSottoclasse();
    popSelect('sel-bg', DB.background);
    popSelect('sel-dio', DB.dei);
    popSelect('sel-evento', DB.eventi);
    popSelect('sel-condotta', DB.condotte);

    // Restore saved data if provided
    if (charData) {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
        setVal('sel-sesso',     charData.sesso);
        setVal('sel-eta',       charData.eta);
        setVal('sel-razza',     charData.razza);
        setVal('sel-classe',    charData.classe);
        // Re-populate sottoclasse after class set
        aggiornaSottoclasse();
        setVal('sel-sottoclasse', charData.sottoclasse);
        setVal('sel-bg',        charData.background);
        setVal('sel-dio',       charData.dio);
        setVal('sel-evento',    charData.evento || 'villaggio');
        setVal('sel-condotta',  charData.condotta || 'acciaio');
        if (charData.seed) { const s = document.getElementById('inp-seed'); if (s) s.value = charData.seed; }

        if (charData.pbState) {
            STAT_KEYS.forEach(k => {
                if (charData.pbState[k]) pbState[k] = { ...charData.pbState[k] };
            });
        }
        if (charData.equippedItems) {
            equippedItems = { ...charData.equippedItems };
        }
        if (charData.bagItems) {
            bagItems = [...charData.bagItems];
        }
        if (charData.frammenti) {
            frammentiRaccolti = [...charData.frammenti];
        }
        const zecEl = document.getElementById('val-zecchini');
        if (zecEl && charData.gold !== undefined) zecEl.value = charData.gold;
        const fateEl = document.getElementById('val-fate');
        if (fateEl && charData.destino !== undefined) fateEl.value = charData.destino;
    }

    updateNames();
    if (charData && charData.nome) {
        const selNome = document.getElementById('sel-nome');
        if (selNome) selNome.value = charData.nome;
    }

    buildAttrUI();
    // Restore pbState display after buildAttrUI
    STAT_KEYS.forEach(k => {
        const s = pbState[k];
        const bEl = document.getElementById(`val-base-${k}`);
        const pEl = document.getElementById(`val-prim-${k}`);
        const sEl = document.getElementById(`val-sec-${k}`);
        if (bEl) bEl.textContent = s.base;
        if (pEl) pEl.textContent = (s.prim > 0 ? '+' : '') + s.prim;
        if (sEl) sEl.textContent = (s.sec > 0 ? '+' : '') + s.sec;
    });

    aggiornaPoolUI();
    calcAll();
    refreshInventoryUI();
    renderBag();
    renderItemList();
    renderFragmenti();
    renderShopGrid('armi',      'shop-grid-armi');
    renderShopGrid('pozioni',   'shop-grid-pozioni');
    renderShopGrid('pergamene', 'shop-grid-pergamene');
    renderShopGrid('oggetti',   'shop-grid-oggetti');
    setTimeout(buildMap, 100);
}

function CS_collect() {
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    return {
        sesso:       get('sel-sesso'),
        nome:        get('sel-nome'),
        eta:         get('sel-eta'),
        razza:       get('sel-razza'),
        classe:      get('sel-classe'),
        sottoclasse: get('sel-sottoclasse'),
        background:  get('sel-bg'),
        dio:         get('sel-dio'),
        evento:      get('sel-evento'),
        condotta:    get('sel-condotta'),
        seed:        get('inp-seed'),
        pbState:     JSON.parse(JSON.stringify(pbState)),
        equippedItems: JSON.parse(JSON.stringify(equippedItems)),
        bagItems:    JSON.parse(JSON.stringify(bagItems)),
        gold:        parseInt(get('val-zecchini')) || 1,
        destino:     parseInt(get('val-fate')) || 0,
        frammenti:   [...frammentiRaccolti]
    };
}
