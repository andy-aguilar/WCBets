import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { BettingPage } from "../pages/BettingPage";
import { EcuadorPathPage } from "../pages/EcuadorPathPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <BettingPage />,
      },
      {
        path: "ecuador-path",
        element: <EcuadorPathPage />,
      },
    ],
  },
]);
