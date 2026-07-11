# Review-pakke — Røket v2.0.0 (build 20)

Arbejdsdokument til App Store-/Play-indsendelsen. Udkast skrevet 2026-07-11 —
redigér frit, intet her er endeligt før Casper siger det.

---

## 1. App Review Notes (App Store Connect → App Review Information → Notes)

> **What Røket is**
>
> Røket is a proximity-first activity board: a live map of small, informal
> activities happening near you right now — "coffee and a chat?", "board game
> night", "run along the harbour" — that anyone nearby can join with one tap.
> Its purpose is fighting loneliness by lowering the barrier to meeting people
> around real-world activities.
>
> **How it is meaningfully different from existing apps**
>
> To our knowledge no app on the App Store answers the question "what is
> happening around me right now, and can I join?":
>
> - Meetup is identity- and interest-anchored (join groups, plan ahead) — not
>   proximity-first, not spontaneous.
> - Eventbrite is large, ticketed, planned events.
> - Nextdoor is neighbourhood conversation, not joinable activities.
>
> Røket's combination is new: a full-screen map with a time scrubber (drag a
> 3-hour window across the day and watch nearby activities appear), ephemeral
> activities that delete themselves ~4 hours after they end, and group-chat-only
> communication.
>
> **Why Røket is structurally not a dating app (guideline 4.3(b))**
>
> The unit of the app is the ACTIVITY, not the person:
>
> 1. There is no browsing of people. No grid or list of profiles exists. The
>    map shows activities only.
> 2. There is no photo gallery. Profiles have a single small avatar, a short
>    bio and an activity history. Profiles answer "who is at this activity?",
>    not "do I want to meet this person?".
> 3. Cold direct messages are structurally impossible. All communication
>    happens in an activity's group chat. There is no message button anywhere
>    on a profile.
> 4. 1:1 contact ("Keep in touch") exists ONLY between people who have
>    participated in the same activity, and only with mutual consent — the
>    structural opposite of a dating app's contact-before-meeting pattern.
> 5. Activities, their chats and participant lists auto-delete ~4 hours after
>    the activity ends. Nothing accumulates; the app is about the moment.
> 6. No gender or sexual-orientation data exists anywhere in the app or its
>    data model.
>
> **Browsing without an account**
>
> The map, activities and profiles can be browsed without creating an account
> (guideline 5.1.1). An account is only required to join or create an activity.
>
> **Reviewing the app**
>
> - Demo account: test@test.com / Test1234
> - The map centres on your location. Test activities are seeded around
>   Kalundborg, Denmark — search/move the map there, or simply browse your own
>   area; the demo account's home area contains live seeded activities.
> - To see the core flow: tap an activity pin → the drawer shows details →
>   "Join" → the group chat opens. Drag the time window at the bottom to see
>   later activities.

*(NB: reviewer-lokationen er typisk Californien — overvej at seede 3
aktiviteter på en Cupertino-lokation med ⚡-knappen lige før indsendelse, og
skriv koordinaterne ind i noten ovenfor.)*

---

## 2. App Store-beskrivelse (dansk primær)

**Undertitel (30 tegn):** `Se hvad der sker nær dig – nu`

**Promotekst (170 tegn):**
Kortet viser hvad der sker omkring dig lige nu — kaffe, gåture, brætspil.
Tag med, eller opret din egen aktivitet. Uden profiler at swipe i.

**Beskrivelse:**

Der sker mere omkring dig, end du tror.

Røket er et levende kort over små, uformelle aktiviteter i nærheden — en
kaffe på torvet, en løbetur langs havnen, en brætspilsaften der mangler en
spiller. Se hvad der sker lige nu, træk i tidslinjen for at kigge frem i
dag, og tag med ét tryk.

SÅDAN VIRKER DET
• Kortet viser aktiviteter nær dig — ikke personer
• Træk i tidsvinduet og se dagen folde sig ud
• Tag med ét tryk — snakken foregår i aktivitetens gruppechat
• Opret selv: sæt en nål, vælg tid, færdig
• Aktiviteter forsvinder af sig selv få timer efter de slutter

MØD FOLK — IKKE PROFILER
Ingen profilgalleri, ingen fremmede der skriver til dig. Man kan kun holde
kontakten 1:1 med folk man faktisk har lavet noget sammen med — og kun hvis
begge siger ja.

Kig med uden konto — du skal først oprette dig når du vil være med.

Røket er gratis.

**Nøgleord (100 tegn):**
`aktiviteter,i nærheden,ensomhed,venner,kort,spontan,fællesskab,mødes,gåtur,kaffe,brætspil,social`

---

## 3. Screenshot-plan (6-8 stk, iPhone 6.7" + 6.1")

Seed 3 friske aktiviteter (⚡) FØR der skydes. Light mode som primær,
evt. 1-2 dark til sidst. Statusbar ryddes (fuldt batteri, ingen notifikationer).

1. **Forsiden, drawer kollapset** — kortet med pins, logo-pille, scrubber, nav
   Overlay-tekst: "Se hvad der sker nær dig — lige nu"
2. **Drawer halvt oppe** — aktivitetskort med statusstriber + avatarer
   Overlay: "Tag med ét tryk"
3. **Scrubberen i aktion** — vinduet trukket til aften, andre pins
   Overlay: "Træk i tiden og se dagen folde sig ud"
4. **Aktivitetsdetalje i draweren** — deltagerliste, Deltag-knap
   Overlay: "Alt foregår i grupper"
5. **Gruppechat** — Overlay: "Snak med dem der er med"
6. **Opret-flowet, pin-picker** — Overlay: "Sæt en nål — så er du i gang"
7. *(valgfri)* Hold kontakten-knappen i deltagerlisten —
   Overlay: "Hold kontakten — når I begge vil"
8. *(valgfri)* Dark mode-forside

---

## 4. Play Store (opdatering af eksisterende listing)

- Kort beskrivelse (80 tegn): `Kortet over hvad der sker nær dig lige nu — tag med, eller opret dit eget.`
- Fuld beskrivelse: genbrug App Store-beskrivelsen ovenfor
- Nye screenshots: samme sæt som iOS
- Release notes v2.0.0: "Røket er bygget om fra bunden: et levende kort over
  aktiviteter i nærheden, tidslinje over dagen, gruppechats og meget mere."

---

## 5. Tjekliste før indsendelse

- [ ] N3-regression færdig (notifikations-ruting, Android back, dark mode)
- [ ] Friske seeds på reviewer-lokation (Cupertino?) + Kalundborg
- [ ] Demo-kontoen test@test.com virker og har adgang til seeds
- [ ] Screenshots skudt EFTER redesignet (bundnav + ny scrubber synlig)
- [ ] Privacy-oplysninger i App Store Connect matcher den nye politik
      (INGEN gender/sexuality, ét profilbillede, aktivitetsdata m. auto-slet)
- [ ] Mac: pod install + arkivér build 20 (iOS) / AAB (Play)
- [ ] App Review Notes indsat (sektion 1) med opdaterede seed-koordinater
