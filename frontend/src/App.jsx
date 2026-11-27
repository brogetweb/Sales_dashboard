import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  LayoutDashboard, Users, CalendarDays, CalendarClock, ChartNoAxesCombined,
  Settings, LogOut, Plus, Search, Bell, Pencil, Trash2, CheckCircle,
  Download, Phone, RefreshCw, MessageSquare, MapPin, Save, Clock,
  ChevronLeft, ChevronRight, MoreVertical, Eye
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from "recharts";
import "./App.css";

// API URL configuration
const resolveApiUrl = () => {
  const raw = (import.meta.env.VITE_API_URL || "http://localhost:5000/api")
    .trim()
    .replace(/\/+$/, "");

  return raw.endsWith("/api") ? raw : `${raw}/api`;
};

const API = resolveApiUrl();
const api = axios.create({
  baseURL: API,
  timeout: 20000
});

// Customer remarks
const remarks = [
  "Location not suitable",
  "Price is too high",
  "Property size is small",
  "Property configuration not suitable",
  "Amenities not satisfactory",
  "Family discussion pending",
  "Looking for another property",
  "Not interested currently",
  "Other"
];

const statuses = [
  "Follow-up",
  "Interested",
  "Not Interested",
  "Converted"
];

const chartColors = [
  "#2878ed",
  "#28ad78",
  "#f3a43b",
  "#a66ad5",
  "#ef7777",
  "#48a6bd"
];

// Authentication helpers
const getToken = () => localStorage.getItem("crm_token");

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${getToken()}`
  }
});

// Date helpers
const dateInput = (value) => {
  if (!value) return "";

  const date = new Date(value);

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
};

const formatDate = (value, withTime = false) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(
    "en-IN",
    withTime
      ? {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }
      : {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }
  );
};

// Get latest feedback
const getLatestFeedback = (customer) => {
  const history = customer?.feedbackHistory || [];

  return history[history.length - 1];
};

// Follow-up status
const getReminderState = (customer) => {
  if (customer.followUpDone) return "Completed";

  if (!customer.followUpAt) return "Not scheduled";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(customer.followUpAt);
  due.setHours(0, 0, 0, 0);

  if (due < today) return "Overdue";

  if (due.getTime() === today.getTime()) return "Today";

  return "Upcoming";
};

// Initial form values
const initialForm = () => ({
  name: "",
  mobile: "",
  propertyName: "",
  remark: remarks[0],
  otherRemark: "",
  feedbackDate: new Date().toISOString().slice(0, 10),
  followUpAt: "",
  status: "Follow-up"
});

function App() {
  const [token, setToken] = useState(getToken());

  const [username, setUsername] = useState(
    localStorage.getItem("crm_username") || ""
  );

  const [page, setPage] = useState("dashboard");

  const [customers, setCustomers] = useState([]);

  const [stats, setStats] = useState({
    totalCustomers: 0,
    today: 0,
    overdue: 0,
    upcoming: 0,
    converted: 0,
    reasons: {}
  });

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [followFilter, setFollowFilter] = useState("");

  const [editing, setEditing] = useState(null);

  const [toast, setToast] = useState("");

  const [form, setForm] = useState(initialForm);

  const [pageNumber, setPageNumber] = useState(1);

  const pageSize = 5;

  // Toast notification
  const notify = (message) => {
    setToast(message);

    window.clearTimeout(notify.timer);

    notify.timer = window.setTimeout(() => {
      setToast("");
    }, 3000);
  };

  // Fetch customers and dashboard statistics
  const fetchData = useCallback(async () => {
    if (!getToken()) return;

    setLoading(true);

    try {
      const [customerResponse, statsResponse] = await Promise.all([
        api.get("/customers", authConfig()),
        api.get("/customers/stats", authConfig())
      ]);

      setCustomers(
        Array.isArray(customerResponse.data)
          ? customerResponse.data
          : []
      );

      setStats(statsResponse.data || {
        totalCustomers: 0,
        today: 0,
        overdue: 0,
        upcoming: 0,
        converted: 0,
        reasons: {}
      });

    } catch (error) {
      console.error(
        "Fetch Dashboard Error:",
        error.response?.data || error
      );

      if (error.response?.status === 401) {
        localStorage.removeItem("crm_token");
        localStorage.removeItem("crm_username");

        setToken(null);
        setUsername("");
      } else {
        notify(
          error.response?.data?.message ||
          "Unable to load dashboard"
        );
      }

    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and automatic refresh every 30 seconds
  useEffect(() => {
    if (!token) return;

    fetchData();

    const interval = window.setInterval(fetchData, 30000);

    return () => window.clearInterval(interval);
  }, [token, fetchData]);

  // Login
  const login = async (event) => {
    event.preventDefault();

    const usernameValue = event.target.username.value.trim();
    const passwordValue = event.target.password.value;

    try {
      const response = await api.post("/auth/login", {
        username: usernameValue,
        password: passwordValue
      });

      localStorage.setItem("crm_token", response.data.token);
      localStorage.setItem("crm_username", response.data.username);

      setToken(response.data.token);
      setUsername(response.data.username);

      notify("Login successful");

    } catch (error) {
      console.error(
        "Login Error:",
        error.response?.data || error
      );

      notify(
        error.response?.data?.message ||
        "Login failed"
      );
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_username");

    setToken(null);
    setUsername("");

    setCustomers([]);
    setEditing(null);
    setForm(initialForm());
  };

  // Start adding a new customer remark
  const startNewRemark = () => {
    setEditing(null);
    setForm(initialForm());
    setPage("dashboard");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  // Open customer edit form
  const openEditForm = (customer) => {
    const latest = getLatestFeedback(customer);

    setEditing(customer);

    setForm({
      name: customer.name || "",
      mobile: customer.mobile || "",
      propertyName: customer.propertyName || "",
      remark: latest?.remark || remarks[0],
      otherRemark: latest?.otherRemark || "",
      feedbackDate: latest?.feedbackDate
        ? new Date(latest.feedbackDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      followUpAt: dateInput(customer.followUpAt),
      status: customer.status || "Follow-up"
    });

    setPage("dashboard");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  // SAVE CUSTOMER / UPDATE EXISTING FEEDBACK
  const saveCustomer = async (event) => {
    event.preventDefault();

    try {
      const followUpDate = form.followUpAt
        ? new Date(form.followUpAt).toISOString()
        : null;

      if (editing) {
        // Find the latest feedback
        const latestFeedback = getLatestFeedback(editing);

        // Check whether feedback ID exists
        if (!latestFeedback?._id) {
          notify(
            "Feedback ID not found. Please refresh the dashboard."
          );

          return;
        }

        // STEP 1: Update existing feedback
        await api.patch(
          `/customers/${editing._id}/feedback/${latestFeedback._id}`,
          {
            remark: form.remark,
            otherRemark: form.otherRemark,
            feedbackDate: form.feedbackDate
          },
          authConfig()
        );

        // STEP 2: Update customer status and follow-up
        await api.put(
          `/customers/${editing._id}`,
          {
            status: form.status,
            followUpAt: followUpDate,
            addFeedback: false
          },
          authConfig()
        );

        notify("Customer feedback updated successfully!");

      } else {
        // ADD NEW CUSTOMER OR NEW FEEDBACK
        const payload = {
          ...form,
          mobile: form.mobile.trim(),
          followUpAt: followUpDate
        };

        await api.post(
          "/customers",
          payload,
          authConfig()
        );

        notify("Customer remark saved successfully!");
      }

      // Reset form
      setEditing(null);
      setForm(initialForm());

      // Refresh dashboard data
      await fetchData();

    } catch (error) {
      console.error(
        "Save Customer Error:",
        error.response?.data || error
      );

      notify(
        error.response?.data?.message ||
        "Unable to save customer"
      );
    }
  };

  // Delete customer
  const deleteCustomer = async (id) => {
    if (!window.confirm("Delete this customer record?")) return;

    try {
      await api.delete(
        `/customers/${id}`,
        authConfig()
      );

      await fetchData();

      notify("Customer deleted");

    } catch (error) {
      console.error(
        "Delete Customer Error:",
        error.response?.data || error
      );

      notify(
        error.response?.data?.message ||
        "Delete failed"
      );
    }
  };

  // Complete follow-up
  const completeFollowUp = async (id) => {
    try {
      await api.patch(
        `/customers/${id}/complete-followup`,
        {},
        authConfig()
      );

      await fetchData();

      notify("Follow-up completed");

    } catch (error) {
      console.error(
        "Complete Follow-up Error:",
        error.response?.data || error
      );

      notify(
        error.response?.data?.message ||
        "Unable to complete follow-up"
      );
    }
  };

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const latest = getLatestFeedback(customer);
      const term = search.toLowerCase();

      const searchMatch =
        !term ||
        String(customer.mobile || "").includes(term) ||
        customer.name?.toLowerCase().includes(term) ||
        customer.propertyName?.toLowerCase().includes(term);

      const statusMatch =
        !statusFilter ||
        customer.status === statusFilter ||
        latest?.remark === statusFilter;

      const reminder = getReminderState(customer).toLowerCase();

      const followMatch =
        !followFilter ||
        reminder === followFilter.toLowerCase();

      return searchMatch && statusMatch && followMatch && latest;
    });
  }, [customers, search, statusFilter, followFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setPageNumber(1);
  }, [search, statusFilter, followFilter, page]);

  const paginatedCustomers = filteredCustomers.slice(
    (pageNumber - 1) * pageSize,
    pageNumber * pageSize
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / pageSize)
  );

  // Remark analytics
  const reasonData = useMemo(() => {
    return Object.entries(stats.reasons || {})
      .map(([name, count]) => ({
        name,
        count: Number(count)
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [stats.reasons]);

  // Today's and overdue follow-ups
  const todayFollowups = useMemo(() => {
    return customers
      .filter(
        (customer) =>
          getReminderState(customer) === "Today" ||
          getReminderState(customer) === "Overdue"
      )
      .sort(
        (a, b) =>
          new Date(a.followUpAt) - new Date(b.followUpAt)
      )
      .slice(0, 4);
  }, [customers]);

  // Recent activity
  const recentActivity = useMemo(() => {
    return customers
      .flatMap((customer) => {
        const history = customer.feedbackHistory || [];

        return history.map((item, index) => ({
          id: `${customer._id}-${index}`,
          mobile: customer.mobile,
          type: "remark",
          text: "New remark added",
          detail: item.remark || "Customer feedback",
          date: item.feedbackDate || customer.createdAt
        }));
      })
      .filter((item) => item.date)
      .sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )
      .slice(0, 4);
  }, [customers]);

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "Name",
      "Mobile",
      "Property",
      "Feedback",
      "Other Remark",
      "Feedback Date",
      "Follow-up Date",
      "Status"
    ];

    const rows = filteredCustomers.map((customer) => {
      const latest = getLatestFeedback(customer);

      return [
        customer.name,
        customer.mobile,
        customer.propertyName,
        latest?.remark,
        latest?.otherRemark,
        latest?.feedbackDate,
        customer.followUpAt,
        customer.status
      ];
    });

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "customer-feedback.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  // Sidebar navigation
  const navigation = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard
    },
    {
      id: "customers",
      label: "Customers",
      icon: Users
    },
    {
      id: "followups",
      label: "Follow-ups",
      icon: CalendarDays
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: CalendarClock
    },
    {
      id: "reports",
      label: "Reports",
      icon: ChartNoAxesCombined
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings
    }
  ];

  // Login screen
  if (!token) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={login}>
          <div className="brand-mark">⌂</div>

          <h1>BuilderBroget</h1>
          <p>Customer CRM</p>

          <label>Username</label>

          <input
            name="username"
            required
            placeholder="Enter username"
            autoComplete="username"
          />

          <label>Password</label>

          <input
            name="password"
            type="password"
            required
            placeholder="Enter password"
            autoComplete="current-password"
          />

          <button className="primary-btn full-btn">
            Sign In
          </button>
        </form>

        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // Customer table
  const renderCustomerTable = (list) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mobile Number</th>
            <th>Customer Remark</th>
            <th>Remark Date</th>
            <th>Follow-up Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {list.map((customer) => {
            const latest = getLatestFeedback(customer);

            return (
              <tr key={customer._id}>
                <td>
                  <strong>{customer.mobile}</strong>

                  {customer.name && (
                    <small className="table-sub">
                      {customer.name}
                    </small>
                  )}
                </td>

                <td>
                  <strong className="feedback-text">
                    {latest?.remark || "—"}
                  </strong>

                  {latest?.otherRemark && (
                    <small className="table-sub">
                      {latest.otherRemark}
                    </small>
                  )}
                </td>

                <td>
                  {formatDate(latest?.feedbackDate)}
                </td>

                <td>
                  {formatDate(customer.followUpAt)}
                </td>

                <td>
                  <span
                    className={`status-badge ${String(
                      customer.status || "Follow-up"
                    ).toLowerCase().replaceAll(" ", "-")}`}
                  >
                    {customer.status || "Follow-up"}
                  </span>
                </td>

                <td>
                  <div className="table-actions">
                    <button
                      title="View / Edit"
                      onClick={() => openEditForm(customer)}
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      title="Edit"
                      onClick={() => openEditForm(customer)}
                    >
                      <Pencil size={16} />
                    </button>

                    {customer.followUpAt &&
                      !customer.followUpDone && (
                        <button
                          title="Complete follow-up"
                          onClick={() =>
                            completeFollowUp(customer._id)
                          }
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}

                    <button
                      title="Delete"
                      onClick={() =>
                        deleteCustomer(customer._id)
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {!list.length && (
        <div className="empty-state">
          No customer records found.
        </div>
      )}
    </div>
  );

  // Customer add/edit form
  const customerForm = (
    <form className="remark-form" onSubmit={saveCustomer}>
      <div className="panel-title">
        <span className="title-icon">
          <Plus size={17} />
        </span>

        <h3>
          {editing
            ? "Edit Customer Remark"
            : "Add New Customer Remark"}
        </h3>
      </div>

      <div className="remark-grid">
        <div className="field">
          <label>
            Mobile Number <b>*</b>
          </label>

          <div className="input-icon">
            <Phone size={16} />

            <input
              required
              maxLength={10}
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              value={form.mobile}
              disabled={!!editing}
              onChange={(e) =>
                setForm({
                  ...form,
                  mobile: e.target.value.replace(/\D/g, "")
                })
              }
              placeholder="Enter mobile number"
            />
          </div>
        </div>

        <div className="field">
          <label>
            Remark Date <b>*</b>
          </label>

          <div className="input-icon">
            <CalendarDays size={16} />

            <input
              type="date"
              required
              value={form.feedbackDate}
              onChange={(e) =>
                setForm({
                  ...form,
                  feedbackDate: e.target.value
                })
              }
            />
          </div>
        </div>

        <div className="field full-field">
          <label>
            Customer Remark / Reason <b>*</b>
          </label>

          <div className="input-icon">
            <MapPin size={16} />

            <select
              required
              value={form.remark}
              onChange={(e) =>
                setForm({
                  ...form,
                  remark: e.target.value
                })
              }
            >
              {remarks.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field full-field">
          <label>Additional Details</label>

          <div className="input-icon textarea-icon">
            <MessageSquare size={16} />

            <textarea
              rows="2"
              value={form.otherRemark}
              onChange={(e) =>
                setForm({
                  ...form,
                  otherRemark: e.target.value
                })
              }
              placeholder="Enter additional customer feedback..."
            />
          </div>
        </div>
      </div>

      <div className="followup-divider">
        <RefreshCw size={15} />
        <strong>Follow-up Details</strong>
      </div>

      <div className="followup-grid">
        <div className="field">
          <label>Next Follow-up Date</label>

          <div className="input-icon">
            <CalendarDays size={16} />

            <input
              type="datetime-local"
              value={form.followUpAt}
              onChange={(e) =>
                setForm({
                  ...form,
                  followUpAt: e.target.value
                })
              }
            />
          </div>
        </div>

        <div className="field">
          <label>Status</label>

          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value
              })
            }
          >
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-actions">
        {editing && (
          <button
            type="button"
            className="cancel-btn"
            onClick={startNewRemark}
          >
            Cancel Edit
          </button>
        )}

        <button className="primary-btn save-btn">
          <Save size={16} />

          {editing ? "Save Changes" : "Save Remark"}
        </button>
      </div>
    </form>
  );

  // Main dashboard
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">⌂</div>

          <h2>BuilderBroget</h2>

          <span>Customer CRM</span>
        </div>

        <nav className="side-nav">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${
                page === id ? "active" : ""
              }`}
              onClick={() => {
                setPage(id);
                setSearch("");
                setStatusFilter("");
                setFollowFilter("");
              }}
            >
              <Icon size={19} />

              <span>{label}</span>

              {id === "followups" &&
                stats.today + stats.overdue > 0 && (
                  <i className="nav-count">
                    {stats.today + stats.overdue}
                  </i>
                )}
            </button>
          ))}
        </nav>

        <button className="logout-btn" onClick={logout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>
              {page === "dashboard"
                ? "Welcome Back!"
                : navigation.find((item) => item.id === page)?.label}
            </h1>

            <p>
              {page === "dashboard"
                ? "Here's what's happening with your customers today."
                : "Manage your customer feedback and follow-up activities."}
            </p>
          </div>

          <div className="top-actions">
            <button
              className="icon-btn notification-btn"
              title="Today's follow-ups"
              onClick={() => setPage("followups")}
            >
              <Bell size={20} />

              {stats.today + stats.overdue > 0 && <i />}
            </button>

            <div className="user-menu">
              <div className="user-avatar">
                {(username || "A").slice(0, 2).toUpperCase()}
              </div>

              <div>
                <strong>{username || "Admin"}</strong>
                <small>Administrator</small>
              </div>
            </div>

            <button
              className="icon-btn refresh-btn"
              onClick={fetchData}
              title="Refresh"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {loading && (
          <div className="loading-line">
            Updating dashboard...
          </div>
        )}

        {/* DASHBOARD PAGE */}
        {page === "dashboard" && (
          <>
            <section className="stats-grid">
              <StatCard
                title="Total Customers"
                value={stats.totalCustomers ?? customers.length}
                icon={<Users />}
                tone="blue"
              />

              <StatCard
                title="Follow-ups Today"
                value={stats.today ?? 0}
                icon={<Phone />}
                tone="green"
              />

              <StatCard
                title="Pending Follow-ups"
                value={(stats.upcoming ?? 0) + (stats.overdue ?? 0)}
                icon={<Clock />}
                tone="orange"
              />

              <StatCard
                title="Converted Customers"
                value={stats.converted ?? 0}
                icon={<CheckCircle />}
                tone="mint"
              />
            </section>

            <section className="dashboard-grid">
              {/* CUSTOMER FORM */}
              <div className="panel form-panel">
                {customerForm}
              </div>

              {/* TODAY'S FOLLOW-UPS */}
              <div className="panel todays-panel">
                <div className="panel-heading">
                  <div className="panel-title">
                    <CalendarDays size={19} />
                    <h3>Today's Follow-ups</h3>
                  </div>

                  <span className="pending-pill">
                    {todayFollowups.length} Pending
                  </span>
                </div>

                <div className="today-list">
                  {todayFollowups.map((customer) => {
                    const latest = getLatestFeedback(customer);

                    return (
                      <div
                        className="today-item"
                        key={customer._id}
                      >
                        <div className="call-icon">
                          <Phone size={18} />
                        </div>

                        <div className="today-info">
                          <strong>{customer.mobile}</strong>

                          <p>
                            {latest?.remark || "Follow-up required"}
                          </p>

                          <small>
                            <Clock size={12} />
                            {formatDate(customer.followUpAt, true)}
                          </small>
                        </div>

                        <span
                          className={`status-badge ${getReminderState(
                            customer
                          ).toLowerCase()}`}
                        >
                          {getReminderState(customer)}
                        </span>

                        <button
                          className="mini-action"
                          title="Edit follow-up"
                          onClick={() => openEditForm(customer)}
                        >
                          <MoreVertical size={17} />
                        </button>
                      </div>
                    );
                  })}

                  {!todayFollowups.length && (
                    <div className="empty-compact">
                      No follow-ups due today.
                    </div>
                  )}
                </div>

                <button
                  className="view-all-link"
                  onClick={() => setPage("followups")}
                >
                  View All Follow-ups <span>→</span>
                </button>
              </div>

              {/* REMARK ANALYTICS */}
              <div className="panel analytics-panel">
                <div className="panel-heading">
                  <div className="panel-title">
                    <ChartNoAxesCombined size={19} />
                    <h3>Remark Analytics</h3>
                  </div>
                </div>

                <div className="donut-wrap">
                  {reasonData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reasonData}
                          dataKey="count"
                          nameKey="name"
                          innerRadius="58%"
                          outerRadius="88%"
                          paddingAngle={2}
                        >
                          {reasonData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={
                                chartColors[
                                  index % chartColors.length
                                ]
                              }
                            />
                          ))}
                        </Pie>

                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="donut-empty">
                      No feedback data
                    </div>
                  )}

                  <div className="donut-center">
                    <strong>
                      {stats.totalCustomers ?? customers.length}
                    </strong>

                    <span>Total</span>
                  </div>
                </div>

                <div className="legend-list">
                  {reasonData.slice(0, 5).map((item, index) => (
                    <div className="legend-row" key={item.name}>
                      <span>
                        <i
                          style={{
                            background:
                              chartColors[index % chartColors.length]
                          }}
                        />

                        {item.name}
                      </span>

                      <strong>
                        {Math.round(
                          (item.count /
                            Math.max(
                              1,
                              reasonData.reduce(
                                (sum, x) => sum + x.count,
                                0
                              )
                            )) *
                            100
                        )}
                        %
                      </strong>
                    </div>
                  ))}

                  {!reasonData.length && (
                    <small className="muted">
                      Feedback reasons will appear here.
                    </small>
                  )}
                </div>
              </div>

              {/* CUSTOMER LIST */}
              <div className="panel customer-list-panel">
                <div className="panel-heading customer-list-heading">
                  <div className="panel-title">
                    <Users size={19} />
                    <h3>Customer List</h3>
                  </div>

                  <div className="table-toolbar">
                    <div className="search-box">
                      <Search size={16} />

                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by mobile..."
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All Remarks</option>

                      {remarks.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>

                    <select
                      value={followFilter}
                      onChange={(e) => setFollowFilter(e.target.value)}
                    >
                      <option value="">All Status</option>
                      <option value="today">Today</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="overdue">Overdue</option>
                      <option value="completed">Completed</option>
                    </select>

                    <button
                      className="export-btn"
                      onClick={exportCSV}
                    >
                      <Download size={16} />
                      Export Excel
                    </button>
                  </div>
                </div>

                {renderCustomerTable(paginatedCustomers)}

                <div className="pagination">
                  <span>
                    Showing{" "}
                    {filteredCustomers.length
                      ? (pageNumber - 1) * pageSize + 1
                      : 0}
                    -
                    {Math.min(
                      pageNumber * pageSize,
                      filteredCustomers.length
                    )}{" "}
                    of {filteredCustomers.length} entries
                  </span>

                  <div>
                    <button
                      disabled={pageNumber === 1}
                      onClick={() =>
                        setPageNumber((p) => p - 1)
                      }
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from(
                      { length: totalPages },
                      (_, i) => i + 1
                    )
                      .slice(0, 4)
                      .map((n) => (
                        <button
                          key={n}
                          className={
                            pageNumber === n ? "current" : ""
                          }
                          onClick={() => setPageNumber(n)}
                        >
                          {n}
                        </button>
                      ))}

                    {totalPages > 4 && (
                      <span>… {totalPages}</span>
                    )}

                    <button
                      disabled={pageNumber === totalPages}
                      onClick={() =>
                        setPageNumber((p) => p + 1)
                      }
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* RECENT ACTIVITY */}
              <div className="panel activity-panel">
                <div className="panel-heading">
                  <div className="panel-title">
                    <span className="activity-bolt">ϟ</span>
                    <h3>Recent Activity</h3>
                  </div>
                </div>

                <div className="activity-list">
                  {recentActivity.map((item) => (
                    <div
                      className="activity-item"
                      key={item.id}
                    >
                      <span className="activity-dot">
                        <Plus size={13} />
                      </span>

                      <div>
                        <strong>{item.text}</strong>

                        <p>
                          {item.mobile} · {item.detail}
                        </p>

                        <small>
                          {formatDate(item.date, true)}
                        </small>
                      </div>
                    </div>
                  ))}

                  {!recentActivity.length && (
                    <div className="empty-compact">
                      No recent feedback activity yet.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {/* CUSTOMERS PAGE */}
        {page === "customers" && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <Users size={19} />
                <h3>Customer Records</h3>
              </div>

              <button
                className="export-btn"
                onClick={exportCSV}
              >
                <Download size={16} />
                Export Excel
              </button>
            </div>

            <div className="filter-bar">
              <div className="search-box">
                <Search size={17} />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search mobile, name or property..."
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>

                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            {renderCustomerTable(paginatedCustomers)}

            <div className="pagination">
              <span>
                {filteredCustomers.length} customer records
              </span>

              <div>
                <button
                  disabled={pageNumber === 1}
                  onClick={() =>
                    setPageNumber((p) => p - 1)
                  }
                >
                  <ChevronLeft size={16} />
                </button>

                <span>
                  {pageNumber} / {totalPages}
                </span>

                <button
                  disabled={pageNumber === totalPages}
                  onClick={() =>
                    setPageNumber((p) => p + 1)
                  }
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* FOLLOW-UPS PAGE */}
        {page === "followups" && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <CalendarDays size={19} />
                <h3>Follow-up Management</h3>
              </div>
            </div>

            <div className="filter-bar">
              <select
                value={followFilter}
                onChange={(e) => setFollowFilter(e.target.value)}
              >
                <option value="">All Follow-ups</option>
                <option value="today">Due Today</option>
                <option value="overdue">Overdue</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {renderCustomerTable(
              filteredCustomers.filter(
                (c) => c.followUpAt || c.followUpDone
              )
            )}
          </section>
        )}

        {/* CALENDAR PAGE */}
        {page === "calendar" && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <CalendarDays size={19} />
                <h3>Follow-up Calendar</h3>
              </div>
            </div>

            <div className="calendar-list">
              {customers
                .filter(
                  (c) => c.followUpAt && !c.followUpDone
                )
                .sort(
                  (a, b) =>
                    new Date(a.followUpAt) -
                    new Date(b.followUpAt)
                )
                .map((c) => (
                  <div className="calendar-row" key={c._id}>
                    <div className="calendar-date">
                      {new Date(c.followUpAt).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short"
                        }
                      )}
                    </div>

                    <div>
                      <strong>{c.mobile}</strong>

                      <p>
                        {getLatestFeedback(c)?.remark || "Follow-up"}
                      </p>
                    </div>

                    <span
                      className={`status-badge ${getReminderState(
                        c
                      ).toLowerCase()}`}
                    >
                      {getReminderState(c)}
                    </span>

                    <button
                      className="table-action"
                      onClick={() => openEditForm(c)}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* REPORTS PAGE */}
        {page === "reports" && (
          <>
            <section className="stats-grid report-stats">
              <StatCard
                title="Total Customers"
                value={stats.totalCustomers ?? customers.length}
                icon={<Users />}
                tone="blue"
              />

              <StatCard
                title="Converted"
                value={stats.converted ?? 0}
                icon={<CheckCircle />}
                tone="mint"
              />

              <StatCard
                title="Conversion Rate"
                value={`${
                  customers.length
                    ? (
                        ((stats.converted ?? 0) /
                          customers.length) *
                        100
                      ).toFixed(1)
                    : 0
                }%`}
                icon={<ChartNoAxesCombined />}
                tone="orange"
              />
            </section>

            <section className="panel page-panel">
              <div className="panel-heading">
                <div className="panel-title">
                  <ChartNoAxesCombined size={19} />
                  <h3>Customer Remark Analysis</h3>
                </div>
              </div>

              <div className="report-chart">
                {reasonData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reasonData}
                        dataKey="count"
                        nameKey="name"
                        outerRadius="78%"
                        label
                      >
                        {reasonData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={
                              chartColors[
                                index % chartColors.length
                              ]
                            }
                          />
                        ))}
                      </Pie>

                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    No feedback data available yet.
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* SETTINGS PAGE */}
        {page === "settings" && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <Settings size={19} />
                <h3>Settings</h3>
              </div>
            </div>

            <div className="settings-content">
              <div>
                <strong>Signed-in administrator</strong>
                <p>{username || "Admin"}</p>
              </div>

              <div>
                <strong>Session</strong>
                <p>
                  JWT authentication · Expires according to server token settings
                </p>
              </div>

              <button
                className="logout-settings"
                onClick={logout}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </section>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// Statistics card component
function StatCard({ title, value, icon, tone }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-icon">{icon}</div>

      <div className="stat-copy">
        <strong>{value}</strong>
        <span>{title}</span>
      </div>
    </div>
  );
}

export default App;
