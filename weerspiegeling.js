/* 🪞 De Weerspiegeling (skin "weerspiegelingeng", nov 2026).
   Het hele vak is een donkere, gebroken spiegel van 12 scherven ("zones"). In losse scherven verschijnen
   enge gezichten (een oog, een grijns, een schreeuw), elk vult zijn hele scherf en komt nooit twee keer
   tegelijk in beeld. Af en toe doemt de Weerspiegeling zelf op: een collage van 12 losse stukken, precies in
   de 12 scherven, en dan is er niets anders. Elke stand heeft een eigen collage en kleur.
   Taunt en boos blijven na een wissel even staan (HOU), ook als het spel al terug is naar gewoon. Stuk blijft.

   Gebruik:
     WSP.laad(cb)          -> "laden" | "klaar" | "fout"; cb wordt één keer aangeroepen als alles binnen is
     WSP.html(sleutel, stand)  -> een <span> die het hele vak vult; sleutel = 0/1 voor de spelers, of "keuze" enz.
                              stand = "" / "_taunt" / "_boos" / "_stuk" (zoals skinStand) of "gewoon"/"taunt"/...
     WSP.raak(sleutel)     -> het glas schudt even en er schieten meer gezichten op (bij een klap)
   Het canvas per sleutel blijft bestaan als de HTML opnieuw getekend wordt: de lus hangt het
   steeds terug in de nieuwe <span>, dus de animatie loopt gewoon door. */
const WSP = (() => {
  const W = 512, H = 768, ART = "art/skin-weerspiegelingeng-";
  const HOU = {taunt:6000, boos:5000};   // zo lang blijft een taunt of boos staan (ms)
  const STAND = {
    gewoon:{mot:{tus:[.9,2.2], n:[1,2], duur:[1.6,3], fel:.8, uit:[0,1,2,3,7,9,11,4]}, groot:{tus:[14,22], duur:[2.6,3.6], fel:.62}},
    taunt: {tint:"rgba(140,110,200,.45)", bij:"midden", mot:{tus:[.7,1.6], n:[1,3], duur:[2,3.4], fel:.85, uit:[4,5,8,1,3,11]}, groot:{tus:[11,18], duur:[3.4,4.6], fel:.72}},
    boos:  {tint:"rgba(200,30,45,.55)", mot:{tus:[.3,.9], n:[2,4], duur:[.6,1.4], fel:.95, uit:[6,2,4,10,3,8,0]}, groot:{tus:[9,15], duur:[1.6,2.4], fel:.82}},
    stuk:  {mot:null, groot:{tus:[8,11], duur:[5.5,7.5], fel:.74, spreid:1.4}}};   // stuk: geen losse beelden; de collage komt en gaat zoals bij de andere standen, maar veel langzamer
  const A = {status:"", wacht:[], glas:null, barst:null, tegels:null, col:{}, zones:[], paren:[]};
  const INST = {};
  const rnd = (a, b) => a + Math.random() * (b - a);
  const nu = () => performance.now() / 1000;
  const doek = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const standNaam = s => { s = String(s || "").replace(/^_/, ""); return STAND[s] ? s : "gewoon"; };

  /* de 12 zones, als runs van (zone, lengte) over 512 x 768 pixels */
  const ZONES = "AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/ABIIFwAPCZEADwqZAA8LhgAMCBgADwmQAA8KmAAPC4cADAgZAA8JjwAPCpgADwuHAAwIGgAPCY4ADwqYAA8LhwAMCBsADwmNAA8KmAAPC4cADAgcAA8JjAAPCpgADwuHAAwIHQAPCYwADwqXAA8LhwAMCB4ADwmLAA8KlgAPC4gADAgfAA8JigAPCpUADwuJAAwIIAAPCYoADwqTAA8LigAMCCEADwmKAA8KkgAPC4oADAghAA8JiwAPCpEADwuKAAwIIQAPCYwADwqPAA8LiwAMCCEADwmMAA8KjwAPC4sADAghAA8JjAAPCo8ADwuLAAwIIQAPCYwADwqPAA8LiwAMCCEADwmMAA8KjwAPC4sADAghAA8JjAAPCo8ADwuLAAwIIAAPCY0ADwqPAA8LiwAMCCAADwmNAA8KjwAPC4sADAggAA8JjQAPCo8ADwuLAAwIIAAPCY0ADwqPAA8LiwAMCCAADwmMAA8KkAAPC4sADAggAA8JiwAPCpEADwuLAAwIIAAPCYoADwqSAA8LiwAMCCAADwmJAA8KkwAPC4sADAggAA8JiAAPCpQADwuLAAwIIQAPCYcADwqUAA8LiwAMCCEADwmHAA8KkwAPC4wADAgiAA8JhwAPCpIADwuMAAwIIgAPCYgADwqRAA8LjAAMCCMADwmIAA8KkAAPC4wADAgkAA8JiAAPCo8ADwuMAAwIJQAPCYgADwqOAA8LjAAMCCYADwmIAA8KjQAPC4wADAgnAA8JiAAPCowADwuMAAwIKAAPCYgADwqLAA8LjAAMCCkADwmIAA8KigAPC4wADAgqAA8JhwAPCooADwuMAAwIKwAPCYYADwqJABALjAAMCCwADwmFAA8KiAARC4wADAgtAA8JhAAPCocAEQuNAAwILgAPCYMADwqHABALjgAMCC8ADwmCAA8KhwAPC48ADAgwAA8JgQAPCocADwuPAAwIMQAPCYAADwqHAA8LjwAMCDIADwmAAA8KhgAPC48ADAgzAA8JfwAPCoYADwuPAAwINAAPCX4ADwqGAA8LjwAMCDUADwl9AA8KhgAPC48ADAg2AA8JfAAPCoUADwuQAAwINgAPCXwADwqEAA8LkQAMCDcADwl7AA8KgwAPC5IADAg3AA8JewAPCoIADwuTAAwIOAAPCXoADwqCAA8LkwAMCDgADwl6AA8KgQAPC5QADAg5AA8JeQAPCoEADwuUAAwIOgAPCXgADwqAAA8LlQAMCDsADwl3AA8KgAAPC5UADAg8AA8JdgAPCoAADwuVAAwIPAAPCXYADwqAAA8LlQAMCD0ADwl1AA8KgAAPC5UADAg+AA8JdAAPCoAADwuVAAwIPwAPCXMADwqAAA8LlQAMCEAADwlyAA8KgAAPC5UADAhAAA8JcgAPCn8ADwuWAAwIQQAPCXIADwp+AA8LlgAMCEIADwlyAA8KfQAPC5YADAhDAA8JcQAPCn0ADwuWAAwIRAAPCXAADwp9AA8LlgAMCEUADwlvAA8KfQAPC5YADAhGAA8JbgAPCn0ADwuWAAwIRwAPCW0ADwp9AA8LlgAMCEgADwlsAA8KfQAPC5YADAhJAA8JawAPCn0ADwuWAAwISgAPCWoADwp9AA8LlgAMCEsADwlpAA8KfQAPC5YADAhMAA8JaAAPCn0ADwuWAAwITQAPCWcADwp9AA8LlgAMCE4ADwlmAA8KfQAPC5YADAhPAA8JZQAPCn0ADwuWAAwIUAAPCWQADwp9AA8LlgAMCFEADwljAA8KfQAPC5YADAhSAA8JYgAPCn0ADwuWAAwIUwAPCWEADwp9AA8LlgAMCFQADwlgAA8KfQAPC5YADAhVAA8JXwAPCn0ADwuWAAwIVgAPCV4ADwp+AA8LlQAMCFcADwldAA8KfwAPC5QADAhYAA8JXAAPCoAADwuTAAwIWQAPCVsADwqBAA8LkgAMCFoADwlaAA8KggAPC5EADAhbAA8JWQAPCoMADwuQAAwIXAAPCVkADwqCAA8LkAAMCF0ADwlZAA8KgQAPC5AADAheAA8JWQAPCoEADwuPAAwIXwAPCVkADwqAABALjgAMCGAADwlZAA8KfgARC44ADAhhAA8JWQAPCnsAEguPAAwIYQAPCVoADwp5ABILkAAMCGEADwlbAA8KdwASC5EADAhhAA8JWwAPCnYAEguSAAwIYQAPCVsADwp1ABILkwAMCGEADwlbAA8KdAASC5QADAhhAA8JWwAPCnIAEwuVAAwIYQAPCVsADwpxABMLlgAMCGIADwlaAA8KcAATC5cADAhiAA8JWgAPCm8AEwuYAAwIYgAPCVoADwpuABMLmQAMCGIADwlbAA8KbAATC5oADAhiAA8JWwAPCmsAEQudAAwIYgAPCVwADwppABELngAMCGMADwlbAA8KaAARC58ADAhjAA8JXAAPCmYAEAuhAAwIYwAPCVwADwplABALogAMCGMADwlcAA8KZAAQC6MADAhjAA8JXAAQCmIAEAukAAwIYwAPCV0AEApgABALpQAMCGQADwldABAKXgAQC6YADAhkAA8JXgAPCl0ADwuoAAwIZAAPCV4ADwpcAA8LqQAMCGQADwleAA8KWwAPC6oADAhkAA8JXgAPCloADwurAAwIZAAPCV4ADwpZAA8LrAAMCGQADwleAA8KWAAPC60ADAhkAA8JXgAPClcADwuuAAwIZAAPCV4ADwpWAA8LrwAQCGEADwldAA8KVQAPC7AAEghfAA8JXQAPClUADwuwABMIXgAPCV0ADwpUAA8LsQAUCF0ADwleAA8KUwAPC7EAFQhcAA8JXgAPClMADwuxABYIWwAPCV4ADwpSAA8LsgAXCFoADwleAA8KUQAPC7MAGAhZAA8JXwAPClAADwuzABkIWQAPCV8ADwpOAA8LtAAaCFgADwlgAA8KTAAPC7UAGwhYAA8JYAAPCksADwu1ABwIVwAPCWAADwpKAA8LtgAdCFcADwlfAA8KSgAPC7YAHghWAA8JXwAPCkkADwu3AB8IVQAPCV8ADwpJAA8LtwAMBwQAEAhVAA8JXgAPCkgADwu4AAwHBgAPCFUADwldAA8KRwAPC7kADAcGAA8IVgAPCVwADwpGAA8LugAMBwYADwhXAA8JWwAPCkYADwu6AAwHBgAPCFgADwlaAA8KRQAPC7sADAcHAA8IVwAPCVoADwpEAA8LvAAMBwgADwhXAA8JWQAPCkMADwu9AAwHCQAPCFYADwlZAA8KQgAPC74ADAcKAA8IVgAPCVgADwpCAA8LvgAMBwoADwhWAA8JWAAPCkEADwu/AAwHCgAPCFcADwlXAA8KQAAPC8AADAcKAA8IWAAPCVYADwo/AA8LwQAMBwoADwhZAA8JVQAPCj8ADwvBAAwHCgAPCFoADwlUAA8KPgAPC8IADAcKAA8IWgAPCVQADwo+AA8LwQANBwoAEAhaAA8JUwAPCj4ADwu+ABAHCwAQCFoADwlSAA8KPgAPC7wAEgcMABEIWAAPCVIADwo+AA8LuwATBw0AEQhYAA8JUQAPCj0ADwu7ABQHDgASCFYADwlRAA8KPQAPC7oAFQcPABcIUQAPCVAADwo9AA8LtAAbBxAAFwhRAA8JTwAPCjwADwuzAB0HEQAXCFAADwlPAA8KPAAPC7EAHwcSABcIUAAPCU4ADwo7AA8LrwAiBxMAHAhKAA8JTgAPCjsADwurACYHFAAdCEgAEAlOAA8KOgAPC6cAKgcVAB0IRwARCU0AEAo4AA8LpwArBxYAHQhHABEJTAARCjcADwumACwHGAAcCEcAEQlMABEKNQAPC6YALQcZABwIRwARCUwAEQo0AA8LpQAhDAEADAcaAB0IRgARCUwAEQoyAA8LpQAfDAQADAcbAB8IRAAQCU0AEQoxAA8LpAAeDAYADAcdAB8IQwAPCU4AEQovAA8LpAAeDAcADAceACAIQgAPCU4AEAovAA8LowAeDAgADAcgAB8IQgAPCU4ADwouAA8LowAeDAkADAclABsIQgAPCU0ADwouAA8LoQAaDA8ADAcmAB0IQAAPCUwADwotAA8LoQAZDBEADAcnACIIOgAPCU0ADwosAA8LnwAZDBMADAcpACMIOAAPCU0ADwoqAA8LngAYDBYADAcvACEINQAPCU0ADwopAA8LnQAVDBoADAcxACAINAAQCUwADwopAA8LmwATDB4ADAcyACIIMgAQCUsADwooAA8LmwATDB8ADAczACMIMQAQCUoADwooAA8LmQAUDCAADAc0ACUILwAPCUoADwooAA8LmAAUDCEADAc1ACYILgAPCUgADwopAA8LlwAUDCIADAc3AC0IJgAPCUcADwooAA8LlwAUDCMADAc6ACsIJgAPCUUADwopAA8LlgAUDCQADAc8ACoIJgAPCUQADwooAA8LkwAXDCUADAc+ACkIJgAPCUMADwooAA8LkAAZDCYADAc/ACkIJgAPCUIADwonAA8LjwAaDCcADAdAACkIJgAPCUEADwonAA8LjQAaDCkADAdDACcIJgAPCUAADwonAA8LjAAaDCoADAdJACIIJgAPCT8ADwomAA8LiwAaDCwADAdMACIIJAAPCT4ADwolAA8LigAaDC4ADAdQAB8IJAAPCT0ADwokAA8LiQAbDC8ADAdRAB8IJAAPCTwADwojAA8LdgADCw4AHAwxAAwHVAAdCCQADwk7AA8KIgAPC3UABgsMABwMMgAMB1YAHAgkAA8JOgAPCiEADwt0AAkLCQAcDDQADAdZABoIJAAPCTkADwohAA8LcgAMCwYAHQw1AAwHWwAZCCQADwk5AA8KHwAPC3EAMAw2AAwHZAARCCQADwk5AA8KHgAPC28AMQw3AAwHZQAQCCUADwk4AA8KHQAPC28AMQw4AAwHZgAQCCUADwk3AA8KHAAPC24ALww8AAwHZwAPCCYADwk2AA8KHAAPC20ALQw/AAwHaAAPCCUADwk2ABAKGgAPC2wALQxBAAwHaAAPCCUADwk3ABAKGAAPC2wALAxDAAwHaQAPCCUADwk3ABAKFgAPC2sALQxEAAwHaQAQCCQADwk4ABAKFAAPC2sALAxGAAwHagAQCCQADwk4AA8KEwAPC2oALAxIAAwHawAQCCQADwk4AA8KEQAPC1AARQxKAAwHbAAPCCQADwk5AA8KDwAPC1AAMgwCAA8MTQAMB2wADwglAA8JOQAPCg4ADwtPADEMBQANDE4ADAdsAA8IJgAPCTkADwoNAA8LTgAwDAgACgxQAAwHbAAPCCcADwk4AA8KDQAPC00ALwwLAAcMUgAMB2wADwgnABAJNwAPCg0ADwtMAC4MZgAMB2wADwgoABAJNgAPCg0ADwtLAC0MaAAMB2wADwgpABEJNAAPCg0ADwtKAC0MaQAMB2sADwgrABEJMwAPCg0ADwtJACwMawAMB2sADwgsABEJMgAPCg0ADwtIACwMbAAMB2wADwgsABEJCwACCSQADwoMAA8LSQAqDG4ADAdsAA8ILQASCQgABAkjAA8KDAAPC0oAKAxvAAwHbAAPCC4AHgkiAA8KDAAPC0oAJgxxAAwHbAAPCC8AHwkgAA8KCwAPC0sAJQxyAAwHbAAPCDAAHwkfAA8KCwAPC0wAIgx0AAwHbAASCC4AIgkbAA8KCgAPC00ADwyHAAwHbAATCCwAJAkaAA8KCgAPC00ADwyHAAwHbQATCCoAJgkZAA8KCgAPC00ADwyHAAwHbgAVCAUABQgcACgJGAAPCgkADwtPAA8MhgAMB28AHwgaACoJFwAPCggADwtRAA8MhQAMB3AAHwgYACwJFgAPCggADwtSAA8MhAAMB3EAHwgVAC8JFQAPCgcADwtTAA8MhAAMB3IAIAgSADEJFAAPCgcADwtTAA8MhAAMB3MAIQgPADIJFAAPCgYADwtUAA8MhAAMB3QAJAgKADQJEwAPCgUADwtVAA8MhAAMB3UAJQgHADYJEgAPCgUADwtV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ABcEiQAPA7MAEQKNABYEiQAPA7UAEQKMABUEiQAPA7cAEAKMABQEiQAPA7kADwKMABMEiQAQA7kADwKMABIEiQAQA7oADwKMABEEiQAQA7sADwKMABAEiQAQA70ADwKLAA8EiQAQA74ADwKLAA4EiQAQA78ADwKLAA0EigAPA8EADwKKAAwEiwAPA8EADwKKAAwEiwAPA8IADwKJAAwEiwAPA8IADwKJAAwEiwAPA8MADwKIAAwEiwAPA8MADwKIAAwEiwAPA8MADwKIAAwEiwAPA8MADwKIAAwEiwAPA8MADwKIAAwEiwAPA8MADwKIAAwEiwAPA8IADwKJAAwEiwAPA8EADwKKAAwEiwAPA8EADwKKAAwEiwAPA8EADwKKAAwEiwAPA8EADwKKAAwEiwAPA8EADwKKAAwEiwAPA8IADwKJAAwEiwAPA8MADwKIAAwEiwAPA8QADwKHAAwEiwAPA8QADwKHAAwEiwAPA8UADwKGAAwEiwAPA8YADwKFAAwEiwAPA8YADwKFAAwEiwAPA8cADwKEAAwEiwAPA8gADwKDAAwEiwAPA8kADwKCAAwEiwAPA8oADwKBAAwEiwAPA8oADwKBAAwEiwAPA8sADwKAAAwEigAPA80ADwJ/AAwEigAPA80ADwJ/AAwEigAPA84ADwJ+AAwEiQAPA88ADwJ+AAwEiQAPA9AADwJ9AAwEiQAPA9AADwJ9AAwEiQAPA9EADwJ8AAwEiAAPA9IADwJ8AAwEiAAPA9IADwJ8AAwEiAAPA9IADwJ8AAwEhwAPA9MADwJ8AAwEhwAPA9MADwJ8AAwEhwAPA9MADwJ8AAwEhgAPA9UADwJ7AAwEhgAPA9YADwJ6AAwEhgAPA9cADwJ5AAwEhQAPA9kADwJ4AAwEhQAPA9oADwJ3AAwEhQAPA9oADwJ3AAwEhAAPA9sADwJ3AAwEhAAPA9sADwJ3AAwEhAAPA9sADwJ3AAwEhAAPA9sADwJ3AAwEgwAPA9wADwJ3AAwEgwAPA9wADwJ3AAwEgwAPA9wADwJ3AAwEggAPA94ADwJ2AAwEggAPA98ADwJ1AAwEggAPA+AADwJ0AAwEgQAPA+EADwJ0AAwEgQAPA+IADwJzAAwEgAAPA+QADwJyAAwEgAAPA+QADwJyAAwEgAAPA+QADwJyAAwEgAAPA+QADwJyAAwEfwAPA+UADwJyAAwEfwAPA+UADwJyAAwEfwAPA+YADwJxAAwEfgAPA+cADwJxAAwEfgAPA+cADwJxAAwEfgAPA+cADwJxAAwEfgAPA+cADwJxAAwEfQAPA+gADwJxAAwEfQAPA+gADwJxAAwEfQAPA+gADwJxAAwEfQAPA+gADwJxAAwEfQAPA+gADwJxAAwEfAAPA+kADwJxAAwEfAAPA+oADwJwAAwEfAAPA+sADwJvAAwEfAAPA+sADwJvAAwEfAAPA+wADwJuAAwEewAPA+4ADwJtAAwEewAPA+4ADwJtAAwEegAPA+8ADwJtAAwEegAPA+8ADwJtAAwEegAPA+8ADwJtAAwEegAPA/AADwJsAAwEegAPA/EADwJrAAwEeQAPA/MADwJqAAwEeQAPA/MADwJqAAwEeQAPA/MADwJqAAwEeQAPA/MADwJqAAwEeQAPA/MADwJqAAwEeAAPA/UADwJpAAwEeAAPA/YADwJoAAwEeAAPA/cADwJnAAwEeAAPA/cADwJnAAwEdwAPA/kADwJmAAwEdwAPA/oADwJlAAwEdwAPA/oADwJlAAwEdwAPA/oAEAJkAAwEdwAPA/sAEQJiAAwEdgAPA/wAEwJgAAwEdgAPA/0AFAJeAAwEdgAPA/4AFAJdAAwEdgAPA/8AFAJcAAwEdgAPA/8DAQAUAlsADAR1AA8D/wMDABQCWgAMBHUADwP/AwQAFgJXAAwEdQAPA/8DBQAXAlUADAR0AA8D/wMIABcCUwAMBHQADwP/AwoAFgJSAAwEcwAPA/8DDAAWAlEADARzAA8D/wMNABYCUAAMBHMADwP/Aw4AFwJOAAwEcwAPA/8DDwAXAk0ADARzAA8D/wMRABYCTAAMBHMADwP/AxMAFQJLAAwEcgAPA/8DFgAUAkoADARyAA8D/wMXABQCSQAMBHEADwP/AxkAFAJIAAwEcQAPA/8DGgAUAkcADARxAA8D/wMbABQCRgAMBHAADwP/Ax8AEgJFAAwEcAAPA/8DIQARAkQADARwAA8D/wMjABACQwAMBHAADwP/AyQAEAJCAAwEcAAPA/8DJQAQAkEADARwAA8D/wMmABACQAAMBG8ADwP/AykADwI/AAwEbwAPA/8DKgAPAj4ADARuAA8D/wMsAA8CPQAMBG4ADwP/Ay0ADwI8AAwEbQAPA/8DLwAPAjsADARtAA8D/wMwAA8COgAMBGwADwP/AzIADwI5AAwEbAAPA/8DMwAPAjgADARrAA8D/wM1AA8CNwAMBGoADwP/AzcADwI2AAwEagAPA/8DOAAPAjUADARpAA8D/wM6AA8CNAAMBGkADwP/AzsADwIzAAwEaAAPA/8DPQAPAjIADARoAA8D/wM+AA8CMQAMBGcADwP/A0AADwIwAAwEZwAPA/8DQQAPAi8ADARmAA8D/wNCAA8CLwAMBGYADwP/A0IADwIvAAwEZQAPA/8DQwAPAi8ADARlAA8D/wNEAA8CLgAMBGQADwP/A0YADwItAAwEZAAPA/8DRwAPAiwADARjAA8D/wNJAA8CKwAMBGIADwP/A0sADwIqAAwEYgAPA/8DTAAPAikADARhAA8D/wNOAA8CKAAMBGEADwP/A04ADwIoAAwEYAAPA/8DUAAPAicADARgAA8D/wNQAA8CJwAMBGAADwP/A1EADwImAAwEXwAPA/8DUwAPAiUADARfAA8D/wNUAA8CJAAMBF4ADwP/A1UADwIkAAwEXQAPA/8DVwAPAiMADARcAA8D/wNYAA8CIwD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wAS";
  function maakZones(){
    const b = atob(ZONES), L = new Uint8Array(W * H); let i = 0;
    for(let k = 0; k < b.length; k += 2){ const v = b.charCodeAt(k), n = b.charCodeAt(k + 1); L.fill(v, i, i + n); i += n; }
    const zones = [];
    for(let id = 1; id <= 12; id++){
      const m = doek(), x = m.getContext("2d"), d = x.createImageData(W, H);
      let x0 = W, x1 = 0, y0 = H, y1 = 0, sx = 0, sy = 0, n = 0;
      for(let p = 0; p < W * H; p++) if(L[p] === id){ d.data[p * 4 + 3] = 255; const px = p % W, py = (p / W) | 0;
        sx += px; sy += py; n++; if(px < x0) x0 = px; if(px > x1) x1 = px; if(py < y0) y0 = py; if(py > y1) y1 = py; }
      if(!n) continue;
      x.putImageData(d, 0, 0);
      zones.push({id, mask:m, x0, x1, y0, y1, cx:sx / n, cy:sy / n, leden:[id]});
    }
    A.zones = zones;
    A.paren = zones.map((a, i) => { const b = zones[(i + 1) % zones.length], m = doek(), x = m.getContext("2d");   // twee buurscherven samen
      x.drawImage(a.mask, 0, 0); x.drawImage(b.mask, 0, 0);
      return {id:a.id + "+" + b.id, leden:[a.id, b.id], mask:m, x0:Math.min(a.x0, b.x0), x1:Math.max(a.x1, b.x1), y0:Math.min(a.y0, b.y0), y1:Math.max(a.y1, b.y1),
        cx:(a.cx + b.cx) / 2, cy:(a.cy + b.cy) / 2}; });
  }
  function laad(cb){
    if(A.status === "klaar" || A.status === "fout") return A.status;
    if(cb) A.wacht.push(cb);
    if(A.status === "laden") return A.status;
    A.status = "laden";
    const img = n => new Promise((ok, mis) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mis; i.src = ART + n + ".png"; });
    Promise.all([img("glas"), img("barst"), img("tegels"), img("col-gewoon"), img("col-taunt"), img("col-boos"), img("col-stuk")]).then(r => {
      [A.glas, A.barst, A.tegels, A.col.gewoon, A.col.taunt, A.col.boos, A.col.stuk] = r;
      maakZones(); A.status = "klaar";
    }).catch(() => { A.status = "fout"; }).then(() => { const w = A.wacht; A.wacht = []; w.forEach(f => { try{ f(); }catch(e){} }); });
    return A.status;
  }
  /* tegel i (0..11) uit het vel van 4 x 3 tegels van 300 x 262 */
  const TEGEL = i => [(i % 4) * 300, Math.floor(i / 4) * 262, 300, 262];

  function inst(sl){
    if(INST[sl]) return INST[sl];
    const cv = doek(); cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block";
    const tmp = doek();
    return INST[sl] = {cv, g:cv.getContext("2d"), tmp, tg:tmp.getContext("2d"), stand:"gewoon", wil:"gewoon", tot:0,
      glimpen:[], volgende:nu() + .6, volgGroot:nu() + 8, grootTot:0, gezien:0};
  }
  function zet(I, s){
    const t = nu(); I.wil = s;
    if(s === I.stand) { if(HOU[s]) I.tot = Math.max(I.tot, t + HOU[s] / 1000); return; }
    if(s === "gewoon" && HOU[I.stand] && t < I.tot) return;   // taunt/boos blijft nog even staan
    wissel(I, s);
  }
  function wissel(I, s){
    const t = nu(); I.stand = s; I.glimpen = [];
    if(HOU[s]) I.tot = t + HOU[s] / 1000;
    if(HOU[s]){ verschijn(I); I.volgGroot = t + rnd(STAND[s].groot.tus[0], STAND[s].groot.tus[1]); }   // bij taunt en boos komt ze meteen
    else if(s === "stuk"){ verschijn(I); I.volgGroot = t + rnd(STAND.stuk.groot.tus[0], STAND.stuk.groot.tus[1]); }   // stuk: meteen, en daarna steeds weer
    else if(STAND[s].groot) I.volgGroot = t + rnd(4, 8);
    if(s === "boos") schud(I);
  }
  function schud(I){
    if(I.cv.animate) I.cv.animate([{transform:"translate(0,0)"}, {transform:"translate(-2%,1%)"}, {transform:"translate(1.5%,-1.5%)"},
      {transform:"translate(-1%,-.5%)"}, {transform:"translate(1%,1%)"}, {transform:"translate(0,0)"}], {duration:320, easing:"steps(6)"});
  }
  function verschijn(I){
    const st = STAND[I.stand], gr = st.groot, t = nu();
    const duur = rnd(gr.duur[0], gr.duur[1]), fel = gr.fel * rnd(.9, 1.05);
    I.glimpen.forEach(x => { if(x.mot != null && x.uit == null) x.uit = t; });   // losse beelden zakken weg voordat zij komt
    const spreid = gr.spreid || .45;   // hoe ver de scherven na elkaar opkomen
    I.grootTot = t + .35 + spreid + .12 + duur;
    A.zones.forEach(z => { const af = Math.hypot(z.cx - W * .5, z.cy - H * .4) / Math.hypot(W * .5, H * .6);
      I.glimpen.push({z, t0:t + .35 + af * spreid + rnd(0, .12), duur, fel:fel * rnd(.8, 1), groot:true}); });
  }
  function glimp(I, extra){
    const st = STAND[I.stand], mo = st.mot, t = nu();
    if(!mo || st.blijf || t < I.grootTot) return;   // als zij zelf in beeld is, geen andere beelden
    const inGebruik = new Set(I.glimpen.filter(x => x.mot != null && x.uit == null).map(x => x.mot));   // nooit twee keer hetzelfde beeld
    const bezet = new Set(I.glimpen.filter(x => x.mot != null).flatMap(x => x.z.leden));
    const vrij = z => z.leden.every(id => !bezet.has(id));
    const n = Math.round(rnd(mo.n[0], mo.n[1])) + (extra || 0);
    for(let i = 0; i < n; i++){
      const keus = [...new Set(mo.uit)].filter(m => !inGebruik.has(m)); if(!keus.length) break;
      let pool = (Math.random() < .22 ? A.paren : A.zones).filter(vrij);
      if(!pool.length) pool = A.zones.filter(vrij); if(!pool.length) break;
      if(st.bij === "midden"){ pool.sort((a, b) => Math.hypot(a.cx - W * .5, a.cy - H * .3) - Math.hypot(b.cx - W * .5, b.cy - H * .3)); pool = pool.slice(0, 5); }
      const z = pool[Math.floor(Math.random() * pool.length)], m = keus[Math.floor(Math.random() * keus.length)];
      z.leden.forEach(id => bezet.add(id)); inGebruik.add(m);
      I.glimpen.push({z, mot:m, t0:t + i * rnd(.1, .45), duur:rnd(mo.duur[0], mo.duur[1]), sc:rnd(1.04, 1.18), dx:rnd(-.5, .5), dy:rnd(-.5, .5), fel:mo.fel * rnd(.85, 1)});
    }
  }
  const STIL = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function teken(I){
    const t = nu(), g = I.g, tg = I.tg;
    if(I.stand !== I.wil && !(HOU[I.stand] && t < I.tot)) wissel(I, I.wil);   // de taunt/boos is voorbij
    const st = STAND[I.stand], col = A.col[I.stand] || A.col.gewoon;
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.drawImage(A.glas, 0, 0, W, H);
    if(!STIL){
      if(st.mot && t > I.volgende){ glimp(I); I.volgende = t + rnd(st.mot.tus[0], st.mot.tus[1]); }
      if(st.groot && t > I.volgGroot){ verschijn(I); I.volgGroot = t + rnd(st.groot.tus[0], st.groot.tus[1]); }
    }
    const vast = (st.blijf || STIL) ? A.zones.map((z, i) => ({z, t0:-1e9, duur:2e9, vast:true, fel:(st.blijf ? st.blijf.fel : .6) * (.85 + ((i * 29) % 7) / 40), fase:i * 1.7})) : [];
    for(const gl of vast.concat(I.glimpen)){
      const u = (t - gl.t0) / gl.duur; if(u < 0 || u > 1) continue;
      const env = gl.groot ? Math.min(1, u / .22, (1 - u) / .35) : Math.min(1, u / .25, (1 - u) / .3);
      let a = gl.vast ? gl.fel * (STIL ? 1 : .9 + .1 * Math.sin(t * 1.3 + gl.fase)) : gl.fel * env;
      if(gl.uit != null) a *= Math.max(0, 1 - (t - gl.uit) / .35);
      if(a <= 0) continue;
      const z = gl.z, bw = z.x1 - z.x0 + 1, bh = z.y1 - z.y0 + 1;
      tg.globalCompositeOperation = "source-over"; tg.clearRect(z.x0, z.y0, bw, bh);
      if(gl.mot != null){   // los beeld: vult de hele scherf, zoomt heel langzaam in
        const [sx, sy, sw, sh] = TEGEL(gl.mot), k = Math.max(bw / sw, bh / sh) * gl.sc * (1 + u * .05);
        const w = sw * k, h = sh * k, mx = (z.x0 + z.x1) / 2 + gl.dx * (w - bw) / 2, my = (z.y0 + z.y1) / 2 + gl.dy * (h - bh) / 2;
        tg.drawImage(A.tegels, sx, sy, sw, sh, mx - w / 2, my - h / 2, w, h);
        if(st.tint){ tg.globalCompositeOperation = "color"; tg.fillStyle = st.tint; tg.fillRect(z.x0, z.y0, bw, bh); }
      } else {   // de collage: elk stuk ligt al precies in zijn scherf
        tg.drawImage(col, z.x0 * col.width / W, z.y0 * col.height / H, bw * col.width / W, bh * col.height / H, z.x0, z.y0, bw, bh);
      }
      tg.globalCompositeOperation = "destination-in"; tg.drawImage(z.mask, z.x0, z.y0, bw, bh, z.x0, z.y0, bw, bh);
      g.globalAlpha = a; g.globalCompositeOperation = "screen"; g.drawImage(I.tmp, z.x0, z.y0, bw, bh, z.x0, z.y0, bw, bh);
      g.globalAlpha = a * .55; g.globalCompositeOperation = "source-over"; g.drawImage(I.tmp, z.x0, z.y0, bw, bh, z.x0, z.y0, bw, bh);
    }
    I.glimpen = I.glimpen.filter(gl => t < gl.t0 + gl.duur);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.drawImage(A.barst, 0, 0, W, H);   // de barsten liggen altijd bovenop
  }
  /* de lus: hangt elk canvas in zijn (nieuwe) plek en tekent alleen wat in beeld is; stopt vanzelf */
  let raf = 0;
  function lus(){
    raf = 0; if(A.status !== "klaar") return;
    let iets = false;
    document.querySelectorAll("span.wspglas[data-wsp]").forEach(el => {
      const I = inst(el.dataset.wsp);
      if(I.cv.parentNode !== el) el.appendChild(I.cv);
      zet(I, standNaam(el.dataset.stand));
      I.gezien = nu(); teken(I); iets = true;
    });
    if(iets) raf = requestAnimationFrame(lus);
  }
  function start(){ if(!raf && typeof requestAnimationFrame === "function") raf = requestAnimationFrame(lus); }
  function html(sl, stand){
    if(laad(start) !== "klaar") return "";
    start();
    return `<span class="wspglas" data-wsp="${sl == null ? "x" : sl}" data-stand="${standNaam(stand)}" style="position:absolute;inset:0;display:block;overflow:hidden;pointer-events:none"></span>`;
  }
  function raak(sl){ const I = INST[sl]; if(!I) return; schud(I); glimp(I, 2); }
  return {laad, html, raak, HOU, STAND};
})();
