export default defineAppConfig({
  pages: [
    "pages/login/index",
    "pages/home/index",
    "pages/calendar/index",
    "pages/logs/index",
    "pages/record/index",
    "pages/projects/index",
    "pages/crags/index",
    "pages/crag-search/index",
    "pages/crag-detail/index",
    "pages/crag-area-climbs/index",
    "pages/crag-climb-detail/index",
    "pages/stats/index",
    "pages/me/index",
    "pages/media-gallery/index"
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#F7F1E8",
    navigationBarTitleText: "攀岩成长日志",
    navigationBarTextStyle: "black",
    backgroundColor: "#F3ECE2"
  },
  tabBar: {
    color: "#866E5F",
    selectedColor: "#1F5C49",
    backgroundColor: "#FFF9F3",
    borderStyle: "black",
    list: [
      {
        pagePath: "pages/home/index",
        text: "首页"
      },
      {
        pagePath: "pages/logs/index",
        text: "Logs"
      },
      {
        pagePath: "pages/crags/index",
        text: "Crags"
      },
      {
        pagePath: "pages/stats/index",
        text: "Stats"
      }
    ]
  }
});
