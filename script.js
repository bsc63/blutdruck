// =========================
// Globale Daten / State
// =========================
let data = JSON.parse(localStorage.getItem("bpdata") || "[]");
let filtered = [];          // gefilterte Sicht auf data[]
let chart = null;           // Chart-Instanz


// =========================
// Persistenz & Basisfunktionen
// =========================
function save() {
    localStorage.setItem("bpdata", JSON.stringify(data));
    render();
}

function addEntry() {
    data.push({
        date: date.value,
        time: time.value,
        sys: Number(sys.value),
        dia: Number(dia.value),
        pulse: Number(pulse.value),
        weight: Number(weight.value),
        comment: comment.value
    });
    save();
    updateTitle();
    document.getElementById("weight").value = getLastWeight();

}

function convertDate(d) {
    // Erwartet: "24.06.2022" → "2022-06-24"
    let parts = d.split(".");
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function setDefaultDateTime() {
    const now = new Date();

    // Datum YYYY-MM-DD
    document.getElementById("dateInput").value =
        now.toISOString().slice(0, 10);

    // Uhrzeit HH:MM
    document.getElementById("timeInput").value =
        now.toTimeString().slice(0, 5);
}

function getLastWeight() {
    if (!data || data.length === 0) return "";
    return data[data.length - 1].weight || "";
}





// =========================
// WHO-Farben & Kategorien
// =========================
function whoColor(sys, dia) {
    if (sys >= 180 || dia >= 110) return "#8B0000"; // dunkelrot
    if (sys >= 160 || dia >= 100) return "#FF0000"; // rot
    if (sys >= 140 || dia >= 90)  return "#FF8C00"; // orange
    if (sys >= 130 || dia >= 85)  return "#FFD700"; // gelb
    if (sys >= 120 || dia >= 80)  return "#90EE90"; // hellgrün
    return "#32CD32"; // grün
}

function whoCategory(sys, dia) {
    if (sys >= 180 || dia >= 110) return "Hypertonie Grad 3";
    if (sys >= 160 || dia >= 100) return "Hypertonie Grad 2";
    if (sys >= 140 || dia >= 90)  return "Hypertonie Grad 1";
    if (sys >= 130 || dia >= 85)  return "Hoch-normal";
    if (sys >= 120 || dia >= 80)  return "Normal";
    return "Optimal";
}

function renderWhoLegend() {
    const el = document.getElementById("whoLegend");
    if (!el) return; // verhindert Absturz

    let legend = `
        <div style="display:flex; gap:15px; flex-wrap:wrap;">
            <div><span style="display:inline-block;width:14px;height:14px;background:#32CD32;"></span> Optimal</div>
            <div><span style="display:inline-block;width:14px;height:14px;background:#90EE90;"></span> Normal</div>
            <div><span style="display:inline-block;width:14px;height:14px;background:#FFD700;"></span> Hoch-normal</div>
            <div><span style="display:inline-block;width:14px;height:14px;background:#FF8C00;"></span> Hypertonie Grad 1</div>
            <div><span style="display:inline-block;width:14px;height:14px;background:#FF0000;"></span> Hypertonie Grad 2</div>
            <div><span style="display:inline-block;width:14px;height:14px;background:#8B0000;"></span> Hypertonie Grad 3</div>
        </div>
    `;
    document.getElementById("whoLegend").innerHTML = legend;
}

const whoBackgroundPlugin = {
    id: "whoBackground",
    beforeDraw(chart, args, options) {
        const {ctx, chartArea: {top, bottom, left, right}, scales: {y1}} = chart;

        function band(min, max, color) {
            ctx.fillStyle = color;
            ctx.fillRect(
                left,
                y1.getPixelForValue(max),
                right - left,
                y1.getPixelForValue(min) - y1.getPixelForValue(max)
            );
        }

        // WHO-Bereiche
        band(0, 120, "#32CD3244");     // Optimal
        band(120, 130, "#90EE9044");   // Normal
        band(130, 140, "#FFD70044");   // Hoch-normal
        band(140, 160, "#FF8C0044");   // Hypertonie Grad 1
        band(160, 180, "#FF000044");   // Hypertonie Grad 2
        band(180, 250, "#8B000044");   // Hypertonie Grad 3
    }
};


// =========================
// Einträge löschen / bearbeiten
// =========================
function deleteEntry(index) {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    data.splice(index, 1);
    save();
}

function editEntry(index) {
    let r = data[index];

    let sys = prompt("SYS:", r.sys);
    if (sys === null) return; // Abbruch

    let dia = prompt("DIA:", r.dia);
    let pulse = prompt("Puls:", r.pulse);
    let weight = prompt("Gewicht:", r.weight);
    let comment = prompt("Kommentar:", r.comment);

    data[index] = {
        ...r,
        sys: Number(sys),
        dia: Number(dia),
        pulse: Number(pulse),
        weight: Number(weight),
        comment: comment
    };

    save();
    updateTitle();
}

function finishEdit(span, input, oldValue) {
    const newValue = input.value.trim();
    const filteredIndex = Number(span.dataset.index);
    const field = span.dataset.field;

    span.classList.remove("editing");

    if (newValue === oldValue) {
        span.textContent = oldValue;
        return;
    }

    // Original-Index in data[] finden
    const originalIndex = data.indexOf(filtered[filteredIndex]);

    // Wert speichern
    data[originalIndex][field] = isNaN(newValue) ? newValue : Number(newValue);

    // SYS/DIA neu einfärben
    if (field === "sys" || field === "dia") {
        const r = data[originalIndex];
        const color = whoColor(r.sys, r.dia);
        span.style.color = color;
        span.style.fontWeight = "bold";
    }

    save();
    updateTitle();
}


// =========================
// Render-Logik (Filter, Tabelle, Chart)
// =========================
function render() {
    let from = document.getElementById("filterFrom").value;
    let to = document.getElementById("filterTo").value;

    filtered = data.filter(r => {
        let iso = convertDate(r.date);
        let time = r.time && r.time.length >= 4 ? r.time : "00:00";
        let d = new Date(iso + "T" + time);

        let f = from ? new Date(from + "T00:00") : null;
        let t = to ? new Date(to + "T23:59") : null;

        if (f && d < f) return false;
        if (t && d > t) return false;

        return true;
    });

    renderTable();
    updateChart();
    updateTitle();
}

function renderTable() {
    const table = document.getElementById("table");
    table.innerHTML = "";

    const header = document.createElement("tr");
    header.innerHTML = `
        <th>Datum</th>
        <th>Zeit</th>
        <th>SYS</th>
        <th>DIA</th>
        <th>Puls</th>
        <th>Gewicht</th>
        <th>Kommentar</th>
        <th>Aktion</th>
    `;
    table.appendChild(header);

    filtered.forEach((r, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><span class="editable" data-field="date" data-index="${index}">${r.date}</span></td>
            <td><span class="editable" data-field="time" data-index="${index}">${r.time}</span></td>
            <td><span class="editable sys" data-field="sys" data-index="${index}">${r.sys}</span></td>
            <td><span class="editable dia" data-field="dia" data-index="${index}">${r.dia}</span></td>
            <td><span class="editable" data-field="pulse" data-index="${index}">${r.pulse}</span></td>
            <td><span class="editable" data-field="weight" data-index="${index}">${r.weight || ""}</span></td>
            <td><span class="editable" data-field="comment" data-index="${index}">${r.comment || ""}</span></td>
            <td>
                <button onclick="editEntry(${index})">✏️</button>
                <button onclick="deleteEntry(${index})">🗑️</button>
            </td>
        `;

        table.appendChild(tr);
    });

    // Funktion muss in deinem Code existieren
    if (typeof activateInlineEditing === "function") {
        activateInlineEditing();
    }
}

function updateChart() {
    let ctx = document.getElementById("chart");

    if (chart) chart.destroy();

    if (filtered.length === 0) {
        ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    let sysColors = filtered.map(r => whoColor(r.sys, r.dia));
    let diaColors = filtered.map(r => whoColor(r.sys, r.dia));

    chart = new Chart(ctx, {
        type: "line",
        plugins: [whoBackgroundPlugin],
        data: {
            labels: filtered.map(r => r.date + " " + r.time),
            datasets: [
                {
                    label: "SYS",
                    data: filtered.map(r => r.sys),
                    borderColor: "#cc0000",
                    pointBackgroundColor: sysColors,
                    pointBorderColor: sysColors,
                    pointRadius: 5,
                    yAxisID: "y1"
                },
                {
                    label: "DIA",
                    data: filtered.map(r => r.dia),
                    borderColor: "#0066cc",
                    pointBackgroundColor: diaColors,
                    pointBorderColor: diaColors,
                    pointRadius: 5,
                    yAxisID: "y1"
                },
                {
                    label: "Gewicht",
                    data: filtered.map(r => r.weight),
                    borderColor: "#666666",
                    backgroundColor: "#666666",
                    pointRadius: 2,
                    yAxisID: "y2"
                }
            ]
        },
        options: {
            plugins: {
                whoBackground: true,
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            let index = context[0].dataIndex;
                            let r = filtered[index];
                            return "WHO: " + whoCategory(r.sys, r.dia);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 90,
                        minRotation: 90
                    }
                },
                y1: { type: "linear", position: "left" },
                y2: { type: "linear", position: "right" }
            }
        }
    });
}


// =========================
// Dynamischer Titel
// =========================

function trendEmojiFiltered() {
    if (!filtered || filtered.length < 2) return "➖";

    let last = filtered[filtered.length - 1];
    let prev = filtered[filtered.length - 2];

    let deltaSys = last.sys - prev.sys;
    let deltaDia = last.dia - prev.dia;

    if (deltaSys >= 5 || deltaDia >= 5) return "📈";  // steigend
    if (deltaSys <= -5 || deltaDia <= -5) return "📉"; // fallend

    return "➖"; // stabil
}


function whoEmoji(sys, dia) {
    if (sys < 120 && dia < 80) return "🟢🙂";
    if (sys < 130 && dia < 85) return "🟡😐";
    if (sys < 140 && dia < 90) return "🟠😟";
    if (sys < 160 && dia < 100) return "🔴⚠️";
    if (sys < 180 && dia < 110) return "🔴🚨";
    return "🆘😱";
}

function updateTitle() {
    if (!filtered || filtered.length === 0) {
        document.title = "Blutdruck – keine Daten";
        return;
    }

    let last = filtered[filtered.length - 1];
    let who = whoEmoji(last.sys, last.dia);
    let trend = trendEmojiFiltered();

    document.title = `${who} ${trend} ${last.sys}/${last.dia} – Puls ${last.pulse}`;
}





// =========================
// CSV Import / Export
// =========================
function importCSV() {
    let fileInput = document.getElementById("csvfile");
    if (!fileInput.files.length) {
        alert("Bitte zuerst eine Datei auswählen.");
        return;
    }

    let file = fileInput.files[0];
    let reader = new FileReader();

    reader.onload = function() {
        data = [];

        let text = reader.result.trim();
        let lines = text.split(/\r?\n/);

        if (lines.length < 2) {
            alert("Datei enthält keine Daten.");
            return;
        }

        // Header überspringen
        lines.slice(1).forEach(l => {
            if (!l.trim()) return;

            let p = l.split(","); // <-- Komma als Trenner

            if (p.length >= 7 && !isNaN(p[2])) {
                data.push({
                    date: p[0],
                    time: p[1],
                    sys: Number(p[2]),
                    dia: Number(p[3]),
                    pulse: Number(p[4]),
                    weight: Number(p[5].replace(",", ".")),
                    comment: p.slice(6).join(",")
                });
            }
        });

        save();
        updateTitle();
        alert("Import abgeschlossen.");
    };

    reader.readAsText(file, "UTF-8");
    document.getElementById("csvfile").value = "";

}

function appendCSV() {
    let fileInput = document.getElementById("csvfile");
    if (!fileInput.files.length) {
        alert("Bitte zuerst eine Datei auswählen.");
        return;
    }

    let file = fileInput.files[0];
    let reader = new FileReader();

    reader.onload = function() {
        let text = reader.result.trim();
        let lines = text.split(/\r?\n/);

        if (lines.length < 2) {
            alert("Datei enthält keine Daten.");
            return;
        }

        // Header überspringen
        lines.slice(1).forEach(l => {
            if (!l.trim()) return;

            let p = l.split(",");

            if (p.length >= 7 && !isNaN(p[2])) {

                // 🔥 Duplikate verhindern:
                // Ein Datensatz ist eindeutig durch Datum + Zeit
                let exists = data.some(r =>
                    r.date === p[0] &&
                    r.time === p[1]
                );

                if (!exists) {
                    data.push({
                        date: p[0],
                        time: p[1],
                        sys: Number(p[2]),
                        dia: Number(p[3]),
                        pulse: Number(p[4]),
                        weight: Number(p[5].replace(",", ".")),
                        comment: p.slice(6).join(",")
                    });
                }
            }
        });

        save();
        updateTitle();
        alert("Neue Messwerte wurden angehängt.");
    };

    reader.readAsText(file, "UTF-8");
    document.getElementById("csvfile").value = "";

}



function exportCSV() {
    // Header
    let csv = "Datum,Zeit,Systolisch,Diastolisch,Puls,Gewicht,Kommentar\n" +
        data.map(r =>
            `${r.date},${r.time},${r.sys},${r.dia},${r.pulse},${r.weight},${r.comment}`
        ).join("\n");

    // Blob als CSV
    let blob = new Blob([csv], { type: "text/csv" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;

    // Dateiname wie beim PDF
    let first = data[0].date.replace(/\./g, "-");
    let last  = data[data.length - 1].date.replace(/\./g, "-");

    let filename = "";

    if (data.length === 1) {
        filename = `blutdruck_${first}.csv`;
    } else if (first === last) {
        filename = `blutdruck_${first}.csv`;
    } else {
        filename = `blutdruck_${first}_bis_${last}.csv`;
    }

    a.download = filename;
    a.click();
}


// =========================
// Statistik-Helfer
// =========================
function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
    let s = [...arr].sort((a, b) => a - b);
    let m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function whoStats(list) {
    let counts = {
        "Optimal": 0,
        "Normal": 0,
        "Hoch-normal": 0,
        "Hypertonie Grad 1": 0,
        "Hypertonie Grad 2": 0,
        "Hypertonie Grad 3": 0
    };
    list.forEach(r => counts[whoCategory(r.sys, r.dia)]++);
    return counts;
}


// =========================
// PDF-Export
// =========================
async function exportPDF() {
    const { jsPDF } = window.jspdf;

    let pdf = new jsPDF("p", "mm", "a4");
    let list = filtered;

    let sysArr = list.map(r => r.sys);
    let diaArr = list.map(r => r.dia);
    let weightArr = list.map(r => r.weight).filter(x => x);
    let pulseArr = list.map(r => r.pulse).filter(x => x);

    let who = whoStats(list);

    // --- SEITE 1: TITEL + STATISTIK + CHART ---
    pdf.setFontSize(18);
    pdf.text("Blutdruck & Gewicht – Auswertung", 10, 15);

    pdf.setFontSize(11);
    pdf.text(
        `Zeitraum: ${list[0].date} bis ${list[list.length - 1].date}    |    Messungen: ${list.length}`,
        10,
        30
    );

    pdf.text(
        `Durchschnitt SYS: ${avg(sysArr).toFixed(1)}    |    Durchschnitt DIA: ${avg(diaArr).toFixed(1)}`,
        10,
        40
    );

    pdf.text(
        `Median SYS: ${median(sysArr)}    |    Median DIA: ${median(diaArr)}`,
        10,
        50
    );

    pdf.text(
        `Max SYS: ${Math.max(...sysArr)}    |    Min SYS: ${Math.min(...sysArr)}    |    Max DIA: ${Math.max(...diaArr)}    |    Min DIA: ${Math.min(...diaArr)}`,
        10,
        60
    );

// --- WHO-Verteilung kompakt einzeilig ---
pdf.setFontSize(9.5);                 // 🔥 kleinere Schrift
pdf.setFont("helvetica", "bold");   // 🔥 kein undefined mehr

let whoText = Object.entries(who)
    .map(([k, v]) => `${k}: ${v}`)
    .join("   |   ");

pdf.text(whoText, 10, 70);          // bleibt einzeilig


    let yWHO = 70;
    let x = 10;

    const whoExample = {
        "Optimal": whoColor(110, 70),
        "Normal": whoColor(125, 82),
        "Hoch-normal": whoColor(135, 88),
        "Hypertonie Grad 1": whoColor(150, 95),
        "Hypertonie Grad 2": whoColor(170, 105),
        "Hypertonie Grad 3": whoColor(190, 115)
    };

    Object.entries(who).forEach(([k, v]) => {
        pdf.setTextColor(whoExample[k]);
        let text = `${k}: ${v}   |   `;
        pdf.text(text, x, yWHO);
        x += pdf.getTextWidth(text);
    });

    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, "normal");

    // Chart
    let chartCanvas = document.getElementById("chart");
    let img = await html2canvas(chartCanvas, { scale: 3 });
    pdf.addImage(img.toDataURL("image/png"), "PNG", 10, 80, 190, 110);

    // --- SEITE 2: TABELLE ---
    pdf.addPage("a4", "p");

    pdf.setFontSize(14);
    pdf.text("Messwerte:", 10, 15);

    let yy = 25;
    pdf.setFontSize(11);

    pdf.setFont(undefined, "bold");
    pdf.text("Datum", 10, yy);
    pdf.text("Zeit", 40, yy);
    pdf.text("SYS", 70, yy);
    pdf.text("DIA", 90, yy);
    pdf.text("Puls", 110, yy);
    pdf.text("Gewicht", 130, yy);
    pdf.text("Kommentar", 160, yy);

    pdf.setFont(undefined, "normal");
    yy += 8;

    list.forEach(r => {
        let color = whoColor(r.sys, r.dia);

        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, "normal");
        pdf.text(r.date, 10, yy);
        pdf.text(r.time, 40, yy);

        pdf.setTextColor(color);
        pdf.setFont(undefined, "bold");
        pdf.text(String(r.sys), 70, yy);
        pdf.text(String(r.dia), 90, yy);

        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, "normal");
        pdf.text(String(r.pulse), 110, yy);
        pdf.text(String(r.weight), 130, yy);

        let comment = pdf.splitTextToSize(r.comment || "", 40);
        pdf.text(comment, 160, yy);

        yy += Math.max(8, comment.length * 5);

        if (yy > 280) {
            pdf.addPage("a4", "p");
            yy = 20;
        }
    });

    // 🔥 automatischer Dateiname
let first = list[0].date.replace(/\./g, "-");
let last  = list[list.length - 1].date.replace(/\./g, "-");

let filename = "";

if (list.length === 1) {
    filename = `blutdruck_${first}.pdf`;
} else if (first === last) {
    filename = `blutdruck_${first}.pdf`;
} else {
    filename = `blutdruck_${first}_bis_${last}.pdf`;
}

pdf.save(filename);
}


// =========================
// Initialer Start
// =========================
renderWhoLegend();
render();
setDefaultDateTime();
updateTitle();
document.getElementById("weight").value = getLastWeight();
