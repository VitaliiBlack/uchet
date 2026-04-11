import Calendar from "../components/Calendar";
import "../components/Calendar.module.css";

export default async function Home() {
  return (
    <div className="app-container app-container--calendar">
      <Calendar />
    </div>
  );
}
