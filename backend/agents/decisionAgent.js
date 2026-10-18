function buildDecisionReport(investigatorReport) {
  const issue = investigatorReport.issue || '';

  if (issue.includes('המערכת תקינה')) {
    return {
      agent: 'decision-agent',
      verdict: 'לא זוהתה תקלה',
      rationale: 'המערכת תקינה וכל הבדיקות נמצאות בטווחי הפעולה הרגילים.',
      recommendation: 'המשך במעקב ושמור על ההטמעה הנוכחית ללא התערבות.'
    };
  }

  if (issue.includes('מסד הנתונים אינו זמין')) {
    return {
      agent: 'decision-agent',
      verdict: 'הגברת התראה על פגיעה במסד הנתונים',
      rationale: 'התלות העיקרית נכשלת והשירות מדווח על חוסר זמינות של מסד הנתונים.',
      recommendation: 'הפעל מחדש את מסד הנתונים, אמת את האישורים ויכולת ההגעה לשרת, וודא שהצומת הראשי זמין לפני הפצה מחדש.'
    };
  }

  if (issue.includes('זמן תגובה איטי')) {
    return {
      agent: 'decision-agent',
      verdict: 'חקירת ביצועים',
      rationale: 'השירות חורג מהסף של זמן התגובה והמסד נתון ככל הנראה מאט את מסלול הבקשה.',
      recommendation: 'סקור את תכנית השאילתה האיטית, הוסף אינדקסים או Cache לקריאות חמות, ושקול להרחיב את מסד הנתונים או את מספר ה-workers של ה-API.'
    };
  }

  return {
    agent: 'decision-agent',
    verdict: 'חקירת פסק זמן',
    rationale: 'הבקשה נתקעת בזמן ההמתנה לסיום שאילתת מסד הנתונים.',
    recommendation: 'בדוק את שאילתה הארוכה, הפחת את גודל העסקאות, והגדל את זמן הפסק רק לאחר שאמתת את הסיבה השורשית.'
  };
}

module.exports = {
  buildDecisionReport
};
