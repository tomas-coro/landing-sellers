// js/catalogo-prezzi.js
window.CATALOGO_PREZZI_LE={
  formule:{
    mensile:{id:'mensile',nome:'Start mensile',prezzoBase:39,periodicita:'mese',setup:150},
    annuale:{id:'annuale',nome:'Start annuale',prezzoBase:468,periodicita:'anno',setup:0}
  },
  upgrade:[
    {id:'modulo_dinamico',nome:'Modulo di contatto dinamico',prezzoMensile:3},
    {id:'gallery_dinamica',nome:'Gallery dinamica',prezzoMensile:3},
    {id:'chatbot_ai',nome:'Chatbot AI personalizzato',prezzoMensile:18}
  ],
  paginaExtra:{id:'pagina_extra',nome:'Pagina extra',prezzoMensile:6,max:15},
  multilingua:{id:'multilingua',nome:'Multilingua',prezzoMensilePerLingua:2,max:5},
  annuali:{
    dominioIt:{id:'dominio_it',nome:'Dominio .it',prezzo:30},
    dominioCom:{id:'dominio_com',nome:'Dominio .com',prezzo:45},
    email5:{id:'email_5_caselle',nome:'Email - 5 caselle da 1 GB',prezzo:35}
  },
  sicurezza:{id:'pacchetto_sicurezza',nome:'Conservazione garantita per 12 mesi',prezzo:100}
};
