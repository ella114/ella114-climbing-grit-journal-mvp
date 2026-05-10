import { ScrollView, View } from "@tarojs/components";
import { useState } from "react";
import { Card, PageHeader } from "@/components/common";
import { useBootstrapData } from "@/hooks/use-bootstrap-data";
import { useProtectedPage } from "@/hooks/use-protected-page";

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const INITIAL_MONTH_SPAN = 60;
const EXTEND_MONTH_SPAN = 24;

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function monthFromKey(monthKey: number) {
  return new Date(Math.floor(monthKey / 12), monthKey % 12, 1);
}

function getMonthElementId(monthKey: number) {
  return `month-${monthKey}`;
}

function getMonthRange(startMonthKey: number, endMonthKey: number) {
  return Array.from({ length: endMonthKey - startMonthKey + 1 }, (_, index) => monthFromKey(startMonthKey + index));
}

function getMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1));
}

export default function CalendarPage() {
  const auth = useProtectedPage();
  const { sessions, projects } = useBootstrapData(auth.isAuthenticated && !auth.isLoading);
  const today = new Date();
  const todayKey = formatDateKey(today);
  const currentMonthKey = getMonthKey(today);
  const [startMonthKey, setStartMonthKey] = useState(currentMonthKey - INITIAL_MONTH_SPAN);
  const [endMonthKey, setEndMonthKey] = useState(currentMonthKey + INITIAL_MONTH_SPAN);
  const [scrollIntoView, setScrollIntoView] = useState(getMonthElementId(currentMonthKey));
  const months = getMonthRange(startMonthKey, endMonthKey);
  const sessionCountByDate = sessions.reduce<Record<string, number>>((map, session) => {
    map[session.date] = (map[session.date] ?? 0) + 1;
    return map;
  }, {});
  const sentProjectCountByDate = projects.reduce<Record<string, number>>((map, project) => {
    if (project.sentDate) {
      map[project.sentDate] = (map[project.sentDate] ?? 0) + 1;
    }

    return map;
  }, {});

  return (
    <View className="page calendar-page">
      <PageHeader title="日历" showBack />

      <ScrollView
        scrollY
        enhanced
        scrollAnchoring
        showScrollbar={false}
        upperThreshold={360}
        lowerThreshold={360}
        scrollIntoView={scrollIntoView}
        scrollWithAnimation={false}
        className="calendar-scroll"
        onScrollToUpper={() => {
          const previousStartMonthKey = startMonthKey;
          setStartMonthKey((monthKey) => monthKey - EXTEND_MONTH_SPAN);
          setScrollIntoView(getMonthElementId(previousStartMonthKey));
        }}
        onScrollToLower={() => {
          setEndMonthKey((monthKey) => monthKey + EXTEND_MONTH_SPAN);
          setScrollIntoView("");
        }}
      >
        <Card>
          <View className="calendar-weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <View key={label} className="calendar-weekday">
                {label}
              </View>
            ))}
          </View>

          {months.map((monthDate) => {
            const monthDays = getMonthDays(monthDate);
            const leadingBlanks = monthDays[0].getDay();

            return (
              <View
                id={getMonthElementId(getMonthKey(monthDate))}
                key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                className="calendar-month"
              >
                <View className="calendar-month-title">
                  {monthDate.getFullYear()}年 {monthDate.getMonth() + 1}月
                </View>
                <View className="calendar-grid">
                  {Array.from({ length: leadingBlanks }).map((_, index) => (
                    <View key={`blank-${index}`} className="calendar-day calendar-day-empty" />
                  ))}
                  {monthDays.map((day) => {
                    const dateKey = formatDateKey(day);
                    const sessionCount = sessionCountByDate[dateKey] ?? 0;
                    const sentProjectCount = sentProjectCountByDate[dateKey] ?? 0;
                    const hasActivity = sessionCount > 0 || sentProjectCount > 0;
                    const isToday = dateKey === todayKey;

                    return (
                      <View key={dateKey} className={`calendar-day ${isToday ? "today" : ""} ${hasActivity ? "has-activity" : ""}`}>
                        <View className="calendar-day-number">{day.getDate()}</View>
                        {hasActivity ? (
                          <View className="calendar-day-meta">
                            {sessionCount ? <View>{sessionCount} session</View> : null}
                            {sentProjectCount ? <View>{sentProjectCount} project sent</View> : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
