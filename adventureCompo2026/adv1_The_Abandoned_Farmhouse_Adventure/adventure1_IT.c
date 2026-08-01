/*
 *
 * The Abandoned Farm House Adventure
 *
 * Jeff Tranter <tranter@pobox.com>
 *
 * Written in standard C but designed to run on the Apple Replica 1
 * or Apple II using the CC65 6502 assembler.
 *
 * Copyright 2012-2022 Jeff Tranter
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Revision History:
 *
 * Version  Date         Comments
 * -------  ----         --------
 * 0.0      13 Mar 2012  First alpha version
 * 0.1      18 Mar 2012  First beta version
 * 0.9      19 Mar 2012  First public release
 * 1.0      06 Sep 2015  Lower case and other Apple II improvements.
 * 1.1      26 Jul 2022  Added backup/restore commands.
 * 
 * Italian Translation and Parser Adjustments
 *
 */

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef __CC65__
#include <conio.h>
#endif

/* Define FILEIO if you want backup and restore commands to use files.
 * Otherwise uses memory. Requires platform support for file i/o
 * (known to work on Apple 2 and Commodore 64 with cc65 as well as
 * Linux.
 */

#if defined(__linux__) || defined(__APPLE2ENH__) || defined(__C64__)
#define FILEIO 1
#endif

/* CONSTANTS */

/* Maximum number of items user can carry */
#define MAXITEMS 5

/* Number of locations */
#define NUMLOCATIONS 32

/* Number of (memory-resident) saved games */
#define SAVEGAMES 10

/* TYPES */

/* To optimize for code size and speed, most numbers are 8-bit chars when compiling for CC65. */
#ifdef __CC65__
typedef char number;
#else
typedef int number;
#endif

/* Directions */
typedef enum {
    North,
    South,
    East,
    West,
    Up,
    Down
} Direction_t;

/* Items */
typedef enum {
    NoItem,
    Key,
    Pitchfork,
    Flashlight,
    Lamp,
    Oil,
    Candybar,
    Bottle,
    Doll,
    ToyCar,
    Matches,
    GoldCoin,
    SilverCoin,
    StaleMeat,
    Book,
    Cheese,
    OldRadio,
    LastItem=OldRadio
} Item_t;

/* Locations */
typedef enum {
    NoLocation,
    Driveway1,
    Driveway2,
    Driveway3,
    Driveway4,
    Driveway5,
    Garage,
    WorkRoom,
    Hayloft,
    Kitchen,
    DiningRoom,
    BottomStairs,
    DrawingRoom,
    Study,
    TopStairs,
    BoysBedroom,
    GirlsBedroom,
    MasterBedroom,
    ServantsQuarters,
    LaundryRoom,
    FurnaceRoom,
    VacantRoom,
    Cistern,
    Tunnel,
    Woods24,
    Woods25,
    Woods26,
    WolfTree,
    Woods28,
    Woods29,
    Woods30,
    Woods31,
} Location_t;

/* Structure to hold entire game state */
typedef struct {
    number valid;
    Item_t Inventory[MAXITEMS];
    Location_t locationOfItem[LastItem+1];
    Direction_t Move[NUMLOCATIONS][6];
    number currentLocation;
    int turnsPlayed;
    number lampLit;
    number lampFilled;
    number ateFood;
    number drankWater;
    number ratAttack;
    number wolfState;
} GameState_t;

/* TABLES */

/* Names of directions */
char *DescriptionOfDirection[] = {
    "nord", "sud", "est", "ovest", "su", "giu'"
};

/* Names of items */
char *DescriptionOfItem[LastItem+1] = {
    "",
    "chiave",
    "forcone",
    "torcia",
    "lampada",
    "olio",
    "barretta",
    "bottiglia",
    "bambola",
    "macchinina",
    "fiammiferi",
    "moneta d'oro",
    "moneta d'argento",
    "carne marcia",
    "libro",
    "formaggio",
    "vecchia radio",
};

/* Names of locations */
char *DescriptionOfLocation[NUMLOCATIONS] = {
    "",
    "nel vialetto vicino alla tua auto",
    "nel vialetto",
    "di fronte al garage",
    "di fronte al fienile",
    "alla porta di casa",
    "nel garage",
    "nel laboratorio del fienile",
    "nel fienile",
    "nella cucina",
    "nella sala da pranzo",
    "in fondo alle scale",
    "nel salotto",
    "nello studio",
    "in cima alle scale",
    "nella camera del bambino",
    "nella camera della bambina",
    "nella camera padronale vicino a una libreria",
    "negli alloggi della servitu'",
    "nella lavanderia nel seminterrato",
    "nella stanza della caldaia",
    "in una stanza vuota vicino a una porta chiusa",
    "nella cisterna",
    "in un tunnel sotterraneo. Ci sono topi qui",
    "nei boschi vicino a una botola",
    "nei boschi",
    "nei boschi",
    "nei boschi vicino a un albero",
    "nei boschi",
    "nei boschi",
    "nei boschi",
    "nei boschi",
};

/* DATA */

/* Inventory of what player is carrying */
Item_t Inventory[MAXITEMS];

/* Location of each item. Index is the item number, returns the location. 0 if item is gone */
Location_t locationOfItem[LastItem+1];

/* Map. Given a location and a direction to move, returns the location it connects to, or 0 if not a valid move. Map can change during game play. */
Direction_t Move[NUMLOCATIONS][6] = {
    /* N  S  E  W  U  D */
    {  0, 0, 0, 0, 0, 0 }, /* 0 */
    {  2, 0, 0, 0, 0, 0 }, /* 1 */
    {  4, 1, 3, 5, 0, 0 }, /* 2 */
    {  0, 0, 6, 2, 0, 0 }, /* 3 */
    {  7, 2, 0, 0, 0, 0 }, /* 4 */
    {  0, 0, 2, 9, 0, 0 }, /* 5 */
    {  0, 0, 0, 3, 0, 0 }, /* 6 */
    {  0, 4, 0, 0, 8, 0 }, /* 7 */
    {  0, 0, 0, 0, 0, 7 }, /* 8 */
    {  0,10, 5, 0, 0,19 }, /* 9 */
    {  9, 0, 0,11, 0, 0 }, /* 10 */
    {  0, 0,10,12,14, 0 }, /* 11 */
    { 13, 0,11, 0, 0, 0 }, /* 12 */
    {  0,12, 0, 0, 0, 0 }, /* 13 */
    { 16, 0,15,17, 0,11 }, /* 14 */
    {  0, 0, 0,14, 0, 0 }, /* 15 */
    {  0,14, 0, 0, 0, 0 }, /* 16 */
    {  0, 0,14, 0, 0, 0 }, /* 17 */
    {  0, 0, 0, 0, 0,13 }, /* 18 */
    {  0, 0, 0,20, 9, 0 }, /* 19 */
    { 21, 0,19, 0, 0, 0 }, /* 20 */
    {  0,20, 0,22, 0, 0 }, /* 21 */
    {  0, 0,21, 0, 0, 0 }, /* 22 */
    { 24,21, 0, 0, 0, 0 }, /* 23 */
    { 29,23, 0,26, 0, 0 }, /* 24 */
    { 26, 0,24, 0, 0, 0 }, /* 25 */
    { 27,25,29, 0, 0, 0 }, /* 26 */
    {  0,26,28, 0, 0, 0 }, /* 27 */
    {  0,29,31,27, 0, 0 }, /* 28 */
    { 28,24,30,26, 0, 0 }, /* 29 */
    { 31, 0, 0,29, 0, 0 }, /* 30 */
    {  0,30, 0,29, 0, 0 }, /* 31 */
};

/* Current location */
number currentLocation;

/* Number of turns played in game */
int turnsPlayed;

/* True if player has lit the lamp. */
number lampLit;

/* True if lamp filled with oil. */
number lampFilled;

/* True if player ate food. */
number ateFood;

/* True if player drank water. */
number drankWater;

/* Incremented each turn you are in the tunnel. */
number ratAttack;

/* Tracks state of wolf attack */
number wolfState;

/* Set when game is over */
number gameOver;

#ifndef FILEIO
/* Memory-resident saved games */
GameState_t savedGame[SAVEGAMES];
#endif

const char *introText = 
"     Avventura nel Casale Abbandonato\n"
"           Di Jeff Tranter\n\n"
"Tuo nipote di tre anni e'\n"
"scomparso ed e' stato visto l'ultima volta\n"
"dirigersi verso la vecchia fattoria di famiglia abbandonata.\n"
"E' un posto pericoloso per giocare. Devi\n"
"trovarlo prima che si faccia male,\n"
"e presto fara' buio...\n";

#ifdef FILEIO
const char *helpString = 
"Comandi validi:\n"
"vai est/ovest/nord/sud/su/giu'\n"
"guarda\n"
"usa <oggetto>\n"
"esamina <oggetto>\n"
"prendi <oggetto>\n"
"lascia <oggetto>\n"
"inventario\n"
"backup <file>\n"
"restore <file>\n"
"aiuto\n"
"esci\n"
"Puoi abbreviare i comandi e le direzioni\n"
"alla prima lettera.\n"
"Digita solo la prima lettera di\n"
"una direzione per muoverti.\n";
#else
const char *helpString = 
"Comandi validi:\n"
"vai est/ovest/nord/sud/su/giu'\n"
"guarda\n"
"usa <oggetto>\n"
"esamina <oggetto>\n"
"prendi <oggetto>\n"
"lascia <oggetto>\n"
"inventario\n"
"backup <numero>\n"
"restore <numero>\n"
"aiuto\n"
"esci\n"
"Puoi abbreviare i comandi e le direzioni\n"
"alla prima lettera.\n"
"Digita solo la prima lettera di\n"
"una direzione per muoverti.\n";
#endif /* FILEIO */

/* Line of user input */
char buffer[80];

#if defined(__OSIC1P__)

/* Have to implement fgets() ourselves as it is not available. TODO:
   Implement support for backspace/delete. */
char* _fgets(char* buf, size_t size, FILE*)
{
    int c;
    char *p;

    /* get max bytes or up to a newline */
    for (p = buf, size--; size > 0; size--) {
        if ((c = cgetc()) == EOF)
            break;
        cputc(c); /* echo back */
        *p++ = c;
        if (c == '\n' || c == '\r')
            break;
    }
    *p = 0;
    if (p == buf || c == EOF)
        return NULL;
    return (p);
}

#define fgets _fgets
#define printf cprintf
#endif

/* Clear the screen */
void clearScreen()
{
#if defined(__CC65__) && !defined(__KIM1__)
    clrscr();
#else
    number i;
    for (i = 0; i < 24; ++i)
        printf("\n");
#endif
}

/* Return 1 if carrying an item */
number carryingItem(char *item)
{
    number i;

    for (i = 0; i < MAXITEMS; i++) {
        if ((Inventory[i] != 0) && (!strcasecmp(DescriptionOfItem[Inventory[i]], item)))
            return 1;
    }
    return 0;
}

/* Return 1 if item it at current location (not carried) */
number itemIsHere(char *item)
{
    number i;

    /* Find number of the item. */
    for (i = 1; i <= LastItem; i++) {
        if (!strcasecmp(item, DescriptionOfItem[i])) {
            /* Found it, but is it here? */
            if (locationOfItem[i] == currentLocation) {
                return 1;
            } else {
                return 0;
            }
        }
    }
    return 0;
}

/* Check for an abbreviated item name. Return full name of item if it
   uniquely matches. Otherwise returns the orignal name. Only check
   for items being carried or at current location. */
char *getMatch(char *name)
{
    int matches = 0;
    int index = 0;
    int i;

    for (i = 1; i <= LastItem; i++) {
        if (carryingItem(DescriptionOfItem[i]) || itemIsHere(DescriptionOfItem[i])) {
            if (!strncasecmp(DescriptionOfItem[i], name, strlen(name))) {
                index = i;
                matches++;
            }
        }
    }

    if (matches == 1) {
        strcpy(name, DescriptionOfItem[index]);
    }
    return name;
}

/* Inventory command */
void doInventory()
{
    number i;
    int found = 0;

    printf("%s", "Hai con te:\n");
    for (i = 0; i < MAXITEMS; i++) {
        if (Inventory[i] != 0) {
            printf("  %s\n", DescriptionOfItem[Inventory[i]]);
            found = 1;
        }
    }
    if (!found)
        printf("  niente\n");
}

/* Help command */
void doHelp()
{
    printf("%s", helpString);
}

/* Look command */
void doLook()
{
    number i, loc, seen;

    printf("Sei %s.\n", DescriptionOfLocation[currentLocation]);

    seen = 0;
    printf("Vedi:\n");
    for (i = 1; i <= LastItem; i++) {
        if (locationOfItem[i] == currentLocation) {
            printf("  %s\n", DescriptionOfItem[i]);
            seen = 1;
        }
    }
    if (!seen)
        printf("  niente di speciale\n");

    printf("Puoi andare:");

    for (i = North; i <= Down; i++) {
        loc = Move[currentLocation][i];
        if (loc != 0) {
            printf(" %s", DescriptionOfDirection[i]);
        }
    }
    printf("\n");
}

/* Quit command */
void doQuit()
{
    printf("%s", "Sei sicuro di voler uscire (s/n)? ");
    fflush(NULL);
    fgets(buffer, sizeof(buffer)-1, stdin);
    if (tolower(buffer[0]) == 's') {
        gameOver = 1;
    }
}

/* Drop command */
void doDrop()
{
    number i;
    char *sp;
    char *item;

    /* Command line should be like "D[ROP] ITEM" Item name will be after first space. */
    sp = strchr(buffer, ' ');
    if (sp == NULL) {
        printf("Lasciare cosa?\n");
        return;
    }

    item = sp + 1;

    item = getMatch(item);

    /* See if we have this item */
    for (i = 0; i < MAXITEMS; i++) {
        if ((Inventory[i] != 0) && (!strcasecmp(DescriptionOfItem[Inventory[i]], item))) {
            /* We have it. Add to location. */
            locationOfItem[Inventory[i]] = currentLocation;
            /* And remove from inventory */
            Inventory[i] = 0;
            printf("Hai lasciato %s.\n", item);
            ++turnsPlayed;
            return;
        }
    }
    /* If here, don't have it. */
    printf("Non hai con te %s.\n", item);
}

/* Take command */
void doTake()
{
    number i, j;
    char *sp;
    char *item;

    /* Command line should be like "T[AKE] ITEM" Item name will be after first space. */
    sp = strchr(buffer, ' ');
    if (sp == NULL) {
        printf("Prendere cosa?\n");
        return;
    }

    item = sp + 1;

    item = getMatch(item);

    if (carryingItem(item)) {
        printf("Lo hai gia' con te.\n");
        return;
    }

    /* Find number of the item. */
    for (i = 1; i <= LastItem; i++) {
        if (!strcasecmp(item, DescriptionOfItem[i])) {
            /* Found it, but is it here? */
            if (locationOfItem[i] == currentLocation) {
            /* It is here. Add to inventory. */
            for (j = 0; j < MAXITEMS; j++) {
                if (Inventory[j] == 0) {
                    Inventory[j] = i;
                    /* And remove from location. */
                    locationOfItem[i] = 0;
                    printf("Hai preso %s.\n", item);
                    ++turnsPlayed;
                    return;
                }
            }

            /* Reached maximum number of items to carry */
            printf("Non puoi trasportare altro. Lascia qualcosa.\n");
            return;
            }
        }
    }

    /* If here, don't see it. */
    printf("Non vedo nessun %s qui.\n", item);
}

/* Go command */
void doGo()
{
    char *sp;
    char dirStr[20];
    char *p;
    Direction_t dir;

    /* Find the direction part */
    sp = strrchr(buffer, ' ');
    if (sp != NULL) {
        strncpy(dirStr, sp+1, 19);
    } else {
        strncpy(dirStr, buffer, 19);
    }
    dirStr[19] = '\0';
    
    for(p = dirStr; *p; p++) {
        *p = tolower(*p);
    }

    if (dirStr[0] == 'n') {
        dir = North;
    } else if (!strcmp(dirStr, "s") || !strncmp(dirStr, "sud", 3)) {
        dir = South;
    } else if (dirStr[0] == 'e') {
        dir = East;
    } else if (dirStr[0] == 'o') {
        dir = West;
    } else if (!strcmp(dirStr, "su") || !strcmp(dirStr, "alto")) {
        dir = Up;
    } else if (!strcmp(dirStr, "g") || !strncmp(dirStr, "giu", 3) || !strncmp(dirStr, "giu'", 4) || !strcmp(dirStr, "basso")) {
        dir = Down;
    } else {
        printf("Andare dove?\n");
        return;
    }

    if (Move[currentLocation][dir] == 0) {
        printf("Non puoi andare a %s da qui.\n", DescriptionOfDirection[dir]);
        return;
    }

    /* We can move */
    currentLocation = Move[currentLocation][dir];
    printf("Sei %s.\n", DescriptionOfLocation[currentLocation]);
    ++turnsPlayed;
}

/* Examine command */
void doExamine()
{
    char *sp;
    char *item;

    /* Command line should be like "E[XAMINE] ITEM" Item name will be after first space. */
    sp = strchr(buffer, ' ');
    if (sp == NULL) {
        printf("Esaminare cosa?\n");
        return;
    }

    item = sp + 1;

    item = getMatch(item);

    ++turnsPlayed;

    /* Examine bookcase - not an object */
    if (!strcasecmp(item, "libreria")) {
        printf("Tiri indietro un libro e la libreria\nsi apre rivelando una stanza segreta.\n");
        Move[17][North] = 18;
        return;
    }

    /* Make sure item is being carried or is in the current location */
    if (!carryingItem(item) && !itemIsHere(item)) {
        printf("Non lo vedo qui.\n");
        return;
    }

    /* Examine Book */
    if (!strcasecmp(item, "libro")) {
        printf("E' un libro molto vecchio intitolato\n\"Manuale operativo Apple 1\".\n");
        return;
    }

    /* Examine Flashlight */
    if (!strcasecmp(item, "torcia")) {
        printf("Non ha batterie.\n");
        return;
    }

    /* Examine toy car */
    if (!strcasecmp(item, "macchinina")) {
        printf("E' una bella macchinina.\nA tuo nipote Matthew piacerebbe.\n");
        return;
    }

    /* Examine old radio */
    if (!strcasecmp(item, "vecchia radio")) {
        printf("E' una vecchia radio Zenith 8-S-563 del 1940\ncon chassis 8A02. La accenderesti\nma manca la corrente.\n");
        return;
    }

   /* Nothing special about this item */
   printf("Non noti niente di speciale.\n");
}

/* Use command */
void doUse()
{
    char *sp;
    char *item;

    /* Command line should be like "U[SE] ITEM" Item name will be after first space. */
    sp = strchr(buffer, ' ');
    if (sp == NULL) {
        printf("Usare cosa?\n");
        return;
    }

    item = sp + 1;

    item = getMatch(item);

    /* Make sure item is being carried or is in the current location */
    if (!carryingItem(item) && !itemIsHere(item)) {
        printf("Non lo vedo qui.\n");
        return;
    }

    ++turnsPlayed;

    /* Use key */
    if (!strcasecmp(item, "chiave") && (currentLocation == VacantRoom)) {
        printf("Inserisci la chiave nella porta e si\napre, rivelando un tunnel.\n");
        Move[21][North] = 23;
        return;
    }

    /* Use pitchfork */
    if (!strcasecmp(item, "forcone") && (currentLocation == WolfTree) && (wolfState == 0)) {
        printf("Colpisci il lupo con il forcone.\nUlula e scappa via.\n");
        wolfState = 1;
        return;
    }

    /* Use toy car */
    if (!strcasecmp(item, "macchinina") && (currentLocation == WolfTree && wolfState == 1)) {
        printf("Mostri a Matthew la macchinina e lui\nscende per prenderla. Prendi Matthew\ntra le tue braccia e lo porti a casa.\n");
        wolfState = 2;
        return;
    }

    /* Use oil */
    if (!strcasecmp(item, "olio")) {
        if (carryingItem("lampada")) {
            printf("Riempi la lampada con l'olio.\n");
            lampFilled = 1;
            return;
        } else {
            printf("Non hai niente con cui usarlo.\n");
            return;
        }
    }

    /* Use matches */
    if (!strcasecmp(item, "fiammiferi")) {
        if (carryingItem("lampada")) {
            if (lampFilled) {
                printf("Accendi la lampada. Ci vedi!\n");
                lampLit = 1;
                return;
            } else {
                printf("Non puoi accendere la lampada. Ha bisogno di olio.\n");
                return;
            }
        } else {
            printf("Non c'e' niente da accendere qui\n");
        }
    }

    /* Use candybar */
    if (!strcasecmp(item, "barretta")) {
        printf("Ci voleva proprio. Non senti piu'\nfame.\n");
        ateFood = 1;
        return;
    }

    /* Use bottle */
    if (!strcasecmp(item, "bottiglia")) {
        if (currentLocation == Cistern) {
            printf("Riempi la bottiglia con l'acqua della\ncisterna e bevi. Non hai piu'\nsete.\n");
            drankWater = 1;
            return;
        } else {
            printf("La bottiglia e' vuota. Se solo avessi\ndell'acqua per riempirla!\n");
            return;
        }
    }

    /* Use stale meat */
    if (!strcasecmp(item, "carne marcia")) {
        printf("La carne aveva un pessimo sapore.\nTi senti molto male e sveni.\n");
        gameOver = 1;
        return;
    }

    /* Default */
    printf("Non succede nulla.\n");
}

#ifdef FILEIO
/* Backup command - file version */
void doBackup()
{
    char *sp;
    char *name;
    number i, j;
    FILE *fp;

    /* Command line should be like "B[ACKUP] NAME" */
    /* Save file name will be after first space. */
    sp = strchr(buffer, ' ');
    if (sp == NULL) {
        printf("Backup sotto quale nome?\n");
        return;
    }

    name = sp + 1;

    printf("Backup del gioco con nome '%s'.\n", name);

    fp = fopen(name, "w");
    if (fp == NULL) {
        printf("Impossibile aprire il file '%s'.\n", name);
        return;
    }

    fprintf(fp, "%s\n", "#Adventure1 Save File");

    fprintf(fp, "Inventory:");
    for (i = 0; i < MAXITEMS; i++) {
        fprintf(fp, " %d", Inventory[i]);
    }
    fprintf(fp, "\n");

    fprintf(fp, "Items:");
    for (i = 0; i <= LastItem; i++) {
        fprintf(fp, " %d", locationOfItem[i]);
    }
    fprintf(fp, "\n");

    fprintf(fp, "Map:\n");
    for (i = 0; i < NUMLOCATIONS; i++) {
        for (j = 0; j < 6; j++) {
            fprintf(fp, " %d", Move[i][j]);
        }
        fprintf(fp, "\n");
    }

    fprintf(fp, "Variables: %d %d %d %d %d %d %d %d\n",
           currentLocation,
           turnsPlayed,
           lampLit,
           lampFilled,
           ateFood,
           drankWater,
           ratAttack,
           wolfState);

    i = fclose(fp);
    if (i != 0) {
        printf("Impossibile chiudere il file, codice di errore %d.\n", i);
    }
}
#else
/* Backup command - memory-resident version */
void doBackup()
{
    char *sp;
    number i, j, n;

    /* Command line should be like "B[ACKUP] <NUMBER>" */
    /* Number will be after first space. */
    sp = strchr(buffer, ' ');
    if (sp == NULL) {
        printf("Backup sotto quale numero?\n");
        return;
    }

    n = strtol(sp + 1, NULL, 10);
    if  (n <= 0 || n > SAVEGAMES) {
        printf("Numero backup non valido. Specifica da %d a %d.\n", 1, SAVEGAMES);
        return;
    }

    printf("Backup del gioco al numero %d.\n", n);

    savedGame[n-1].valid = 1;
    for (i = 0; i < MAXITEMS; i++) {
        savedGame[n-1].Inventory[i] = Inventory[i];
    }
    for (i = 0; i < LastItem+1; i++) {
        savedGame[n-1].locationOfItem[i] = locationOfItem[i];
    }
    for (i = 0; i < NUMLOCATIONS; i++) {
        for (j = 0; j < 6; j++) {
            savedGame[n-1].Move[i][j] = Move[i][j];
        }
    }
    savedGame[n-1].currentLocation = currentLocation;
    savedGame[n-1].turnsPlayed = turnsPlayed;
    savedGame[n-1].lampLit = lampLit;
    savedGame[n-1].lampFilled = lampFilled;
    savedGame[n-1].ateFood = ateFood;
    savedGame[n-1].drankWater = drankWater;
    savedGame[n-1].ratAttack = ratAttack;
    savedGame[n-1].wolfState = wolfState;
}

#endif /* FILEIO */

#ifdef FILEIO
/* Restore command - file version */
void doRestore()
{
    char *sp;
    char *name;
    number i, j;
    FILE *fp;

    /* Command line should be like "R[ESTORE] NAME" */
    /* Save file name will be after first space. */
    sp = strchr(buffer, ' ');
    if (sp == NULL) {
        printf("Ripristina da quale file?\n");
        return;
    }

    name = sp + 1;

    printf("Ripristino del gioco dal file '%s'.\n", name);

    fp = fopen(name, "r");
    if (fp == NULL) {
        printf("Impossibile aprire il file '%s'.\n", name);
        return;
    }

    /* Check for header line */
    fgets(buffer, sizeof(buffer) - 1, fp);
    if (strcmp(buffer, "#Adventure1 Save File\n")) {
        printf("Il file non e' un salvataggio valido.\n");
        fclose(fp);
        return;
    }

    /* Inventory: 3 0 0 0 0 */
    i = fscanf(fp, "Inventory: %d %d %d %d %d\n",
           (int*) &Inventory[0],
           (int*) &Inventory[1],
           (int*) &Inventory[2],
           (int*) &Inventory[3],
           (int*) &Inventory[4]);
    if (i != 5) {
        printf("Il file non e' un salvataggio valido.\n");
        fclose(fp);
        return;
    }

    /* Items: 0 1 8 0 7 6 9 2 16 15 18 25 29 10 12 19 */
    i = fscanf(fp, "Items: %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d\n",
           (int*) &locationOfItem[0],
           (int*) &locationOfItem[1],
           (int*) &locationOfItem[2],
           (int*) &locationOfItem[3],
           (int*) &locationOfItem[4],
           (int*) &locationOfItem[5],
           (int*) &locationOfItem[6],
           (int*) &locationOfItem[7],
           (int*) &locationOfItem[8],
           (int*) &locationOfItem[9],
           (int*) &locationOfItem[10],
           (int*) &locationOfItem[11],
           (int*) &locationOfItem[12],
           (int*) &locationOfItem[13],
           (int*) &locationOfItem[14],
           (int*) &locationOfItem[15],
           (int*) &locationOfItem[16]);

    if (i != 17) {
        printf("Il file non e' un salvataggio valido.\n");
        fclose(fp);
        return;
    }

    fscanf(fp, "Map:\n");

    for (i = 0; i < NUMLOCATIONS; i++) {
        j = fscanf(fp, " %d %d %d %d %d %d\n",
               (int*) &Move[i][0],
               (int*) &Move[i][1],
               (int*) &Move[i][2],
               (int*) &Move[i][3],
               (int*) &Move[i][4],
               (int*) &Move[i][5]);
        if (j != 6) {
            printf("Il file non e' un salvataggio valido.\n");
            fclose(fp);
            return;
        }
    }

    /* Variables: 1 0 0 0 0 0 0 0 */
    i = fscanf(fp, "Variables: %d %d %d %d %d %d %d %d\n",
           &currentLocation,
           &turnsPlayed,
           &lampLit,
           &lampFilled,
           &ateFood,
           &drankWater,
           &ratAttack,
           &wolfState);

    if (i != 8) {
        printf("Il file non e' un salvataggio valido.\n");
        fclose(fp);
        return;
    }

    i = fclose(fp);
    if (i != 0) {
        printf("Impossibile chiudere il file, codice di errore %d.\n", i);
    }
}
#else
/* Restore command - memory-resident version */
void doRestore()
{
    char *sp;
    number i, j, n;

    /* Command line should be like "R[ESTORE] <NUMBER>" */
    /* Number will be after first space. */
    sp = strchr(buffer, ' ');
    if (sp == NULL) {
        printf("Ripristina da quale numero?\n");
        return;
    }

    n = strtol(sp + 1, NULL, 10);
    if  (n <= 0 || n > SAVEGAMES) {
        printf("Numero ripristino non valido. Specifica da %d a %d.\n", 1, SAVEGAMES);
        return;
    }

    if (savedGame[n-1].valid != 1) {
        printf("Nessun salvataggio trovato al numero %d.\n", n);
        printf("Salvataggi presenti:");
        for (i = 0; i < SAVEGAMES; i++) {
            if (savedGame[i].valid == 1) {
                printf(" %d", i+1);
            }
        }
        printf("\n");
        return;
    }

    printf("Ripristino del gioco dal numero %d.\n", n);

    savedGame[n-1].valid = 1;
    for (i = 0; i < MAXITEMS; i++) {
        Inventory[i] = savedGame[n-1].Inventory[i];
    }
    for (i = 0; i < LastItem+1; i++) {
        locationOfItem[i] = savedGame[n-1].locationOfItem[i];
    }
    for (i = 0; i < NUMLOCATIONS; i++) {
        for (j = 0; j < 6; j++) {
            Move[i][j] = savedGame[n-1].Move[i][j];
        }
    }
    currentLocation = savedGame[n-1].currentLocation;
    turnsPlayed = savedGame[n-1].turnsPlayed;
    lampLit = savedGame[n-1].lampLit;
    lampFilled = savedGame[n-1].lampFilled;
    ateFood = savedGame[n-1].ateFood;
    drankWater = savedGame[n-1].drankWater;
    ratAttack = savedGame[n-1].ratAttack;
    wolfState = savedGame[n-1].wolfState;
}
#endif /* FILEIO */

/* Prompt user and get a line of input */
void prompt()
{
    printf("? ");
    fflush(NULL);
    fgets(buffer, sizeof(buffer)-1, stdin);

    /* Remove trailing newline */
    buffer[strlen(buffer)-1] = '\0';
}

/* Do special things unrelated to command typed. */
void doActions()
{
    if ((turnsPlayed == 10) && !lampLit) {
        printf("Presto fara' buio. Ti serve\nuna fonte di luce o presto non\npotrai piu' vedere.\n");
    }

    if ((turnsPlayed >= 60) && (!lampLit || (!itemIsHere("lampada") && !carryingItem("lampada")))) {
        printf("E' buio pesto e non hai una luce.\nInciampi dopo un po'\ncadi, batti la testa e sveni.\n");
        gameOver = 1;
        return;
    }

    if ((turnsPlayed == 20) && !drankWater) {
        printf("Hai molta sete.\nDevi bere qualcosa presto.\n");
    }

    if ((turnsPlayed == 30) && !ateFood) {
        printf("Hai molta fame.\nDevi trovare qualcosa da mangiare.\n");
    }

    if ((turnsPlayed == 50) && !drankWater) {
        printf("Sveni a causa della sete.\n");
        gameOver = 1;
        return;
    }

    if ((turnsPlayed == 40) && !ateFood) {
        printf("Sveni per la fame.\n");
        gameOver = 1;
        return;
    }

    if (currentLocation == Tunnel) {
        if (itemIsHere("formaggio")) {
            printf("I topi si avventano sul formaggio.\n");
        } else {
            if (ratAttack < 3) {
                printf("I topi stanno venendo verso di te!\n");
                ++ratAttack;
            } else {
                printf("I topi ti attaccano e sveni.\n");
                gameOver = 1;
                return;
            }
        }
    }

    /* wolfState values:  0 - wolf attacking 1 - wolf gone, Matthew in tree. 2 - Matthew safe, you won. Game over. */
    if (currentLocation == WolfTree) {
        switch (wolfState) {
            case 0:
                printf("Un lupo si aggira intorno all'albero.\nMatthew e' sull'albero. Devi\nsalvarlo! Se solo avessi un'arma!\n");
                break;
            case 1:
                printf("Matthew ha paura a scendere\ndall'albero. Se solo avessi\nqualcosa per convincerlo.\n");
                break;
            case 2:
                printf("Congratulazioni! Ce l'hai fatta e hai vinto\nil gioco. Spero ti sia divertito\na giocare quanto me a crearlo.\n- Jeff Tranter <tranter@pobox.com>\n");
                gameOver = 1;
                return;
            }
    }
}

/* Set variables to values for start of game */
void initialize()
{
    currentLocation = Driveway1;
    lampFilled = 0;
    lampLit = 0;
    ateFood = 0;
    drankWater = 0;
    ratAttack = 0;
    wolfState = 0;
    turnsPlayed = 0;
    gameOver = 0;

    /* These doors can get changed during game and may need to be reset */
    Move[17][North] = 0;
    Move[21][North] = 0;

    /* Set inventory to default */
    memset(Inventory, 0, sizeof(Inventory[0])*MAXITEMS);
    Inventory[0] = Flashlight;

    /* Put items in their default locations */
    locationOfItem[0]  = 0;                /* NoItem */
    locationOfItem[1]  = Driveway1;        /* Key */
    locationOfItem[2]  = Hayloft;          /* Pitchfork */
    locationOfItem[3]  = 0;                /* Flashlight */
    locationOfItem[4]  = WorkRoom;         /* Lamp */
    locationOfItem[5]  = Garage;           /* Oil */
    locationOfItem[6]  = Kitchen;          /* Candybar */
    locationOfItem[7]  = Driveway2;        /* Bottle */
    locationOfItem[8]  = GirlsBedroom;     /* Doll */
    locationOfItem[9]  = BoysBedroom;      /* ToyCar */
    locationOfItem[10] = ServantsQuarters; /* Matches */
    locationOfItem[11] = Woods25;          /* GoldCoin */
    locationOfItem[12] = Woods29;          /* SilverCoin */
    locationOfItem[13] = DiningRoom;       /* StaleMeat */
    locationOfItem[14] = DrawingRoom;      /* Book */
    locationOfItem[15] = LaundryRoom;      /* Cheese */
    locationOfItem[16] = MasterBedroom;    /* OldRadio */
}

/* Main program (obviously) */
int main(void)
{
#ifndef FILEIO
    /* Mark all saved games as initially invalid */
    int i;
    for (i = 0; i < SAVEGAMES; i++) {
        savedGame[i].valid = 0;
    }
#endif

    while (1) {
        initialize();
        clearScreen();
        printf("%s", introText);

        while (!gameOver) {
            prompt();
            if (buffer[0] == '\0') {
            } else if (tolower(buffer[0]) == 'a' || !strncasecmp(buffer, "help", 4)) {
                doHelp();
            } else if (tolower(buffer[0]) == 'i') {
                doInventory();
            } else if (tolower(buffer[0]) == 'q' || !strncasecmp(buffer, "esci", 4)) {
                doQuit();
            } else if ((tolower(buffer[0]) == 'v')
                       || !strcasecmp(buffer, "n") || !strcasecmp(buffer, "s")
                       || !strcasecmp(buffer, "e") || !strcasecmp(buffer, "o")
                       || !strcasecmp(buffer, "su") || !strcasecmp(buffer, "g")
                       || !strcasecmp(buffer, "nord") || !strcasecmp(buffer, "sud")
                       || !strcasecmp(buffer, "est") || !strcasecmp(buffer, "ovest")
                       || !strcasecmp(buffer, "giu'") || !strcasecmp(buffer, "giu")) {
                doGo();
            } else if (tolower(buffer[0]) == 'g' || !strncasecmp(buffer, "osserva", 7) || !strncasecmp(buffer, "look", 4)) {
                doLook();
            } else if (tolower(buffer[0]) == 'p' || !strncasecmp(buffer, "raccogli", 8)) {
                doTake();
            } else if (tolower(buffer[0]) == 'e') {
                doExamine();
            } else if (tolower(buffer[0]) == 'u') {
                doUse();
            } else if (tolower(buffer[0]) == 'l') {
                doDrop();
            } else if (tolower(buffer[0]) == 'b') {
                doBackup();
            } else if (tolower(buffer[0]) == 'r') {
                doRestore();
            } else if (!strcasecmp(buffer, "xyzzy")) {
                printf("Bel tentativo, ma qui non funziona.\n");
            } else {
                printf("Non capisco. Prova a digitare 'aiuto'.\n");
            }

            /* Handle special actions. */
            doActions();
        }

        printf("Partita finita dopo %d turni.\n", turnsPlayed);
        printf("%s", "Vuoi giocare ancora (s/n)? ");
        fflush(NULL);
        fgets(buffer, sizeof(buffer)-1, stdin);
        if (tolower(buffer[0]) == 'n') {
            break;
        }
    }
    return 0;
}