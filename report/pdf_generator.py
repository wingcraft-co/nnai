import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)


def generate_report(parsed: dict, user_profile: dict) -> str:
    os.makedirs("reports", exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = f"reports/nomad_report_{ts}.pdf"

    doc = SimpleDocTemplate(
        path, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )

    styles = getSampleStyleSheet()
    title_s = ParagraphStyle(
        "CustomTitle", parent=styles["Title"],
        fontSize=20, textColor=colors.HexColor("#0C447C"), spaceAfter=12,
    )
    heading_s = ParagraphStyle(
        "CustomHeading", parent=styles["Heading2"],
        fontSize=13, textColor=colors.HexColor("#185FA5"),
        spaceBefore=12, spaceAfter=6,
    )
    body_s = ParagraphStyle(
        "CustomBody", parent=styles["Normal"],
        fontSize=10, leading=14,
    )

    story = []

    story.append(Paragraph("NomadNavigator AI - Immigration Design Report", title_s))
    story.append(Paragraph(
        f"Date: {datetime.now().strftime('%Y-%m-%d')} | "
        f"Nationality: {user_profile.get('nationality','-')} | "
        f"Monthly Income: ${user_profile.get('income',0):,} USD",
        body_s
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0C447C")))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Top 3 Recommended Cities", heading_s))
    for i, city in enumerate(parsed.get("top_cities", [])[:3], 1):
        story.append(Paragraph(
            f"{i}. {city.get('city','')}, {city.get('country','')} "
            f"- {city.get('visa_type','')} | ${city.get('monthly_cost',0):,}/mo "
            f"| Score: {city.get('score','-')}/10",
            body_s
        ))
        story.append(Paragraph(f"   Reason: {city.get('why','')}", body_s))
        story.append(Spacer(1, 6))

    story.append(Paragraph("Visa Checklist", heading_s))
    for item in parsed.get("visa_checklist", []):
        story.append(Paragraph(f"[ ]  {item}", body_s))

    story.append(Paragraph("Monthly Budget Breakdown", heading_s))
    bd = parsed.get("budget_breakdown", {})
    label_map = {"rent": "Rent", "food": "Food", "cowork": "Coworking", "misc": "Misc"}
    table_data = [["Category", "Amount (USD)"]]
    for k, label in label_map.items():
        table_data.append([label, f"${bd.get(k,0):,}"])
    table_data.append(["Total", f"${sum(bd.values()):,}"])
    t = Table(table_data, colWidths=[8*cm, 6*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0C447C")),
        ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
        ("FONTSIZE",   (0,0), (-1,-1), 10),
        ("ROWBACKGROUNDS", (0,1), (-1,-2), [colors.white, colors.HexColor("#EEF4FB")]),
        ("FONTNAME",   (0,-1), (-1,-1), "Helvetica-Bold"),
        ("GRID",       (0,0), (-1,-1), 0.5, colors.HexColor("#CCCCCC")),
    ]))
    story.append(t)

    story.append(Paragraph("First Action Steps", heading_s))
    for j, step in enumerate(parsed.get("first_steps", []), 1):
        story.append(Paragraph(f"{j}. {step}", body_s))

    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "This report is for reference only and does not constitute legal immigration advice.",
        ParagraphStyle("disclaimer", parent=body_s, fontSize=8, textColor=colors.gray)
    ))

    doc.build(story)
    return path
